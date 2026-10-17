import { AssistantMessageComponent, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import {
	Container,
	HStack,
	ScrollView,
	VStack,
	type Component,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

const PANEL_HEIGHT = 12;
const PANEL_BODY_HEIGHT = PANEL_HEIGHT - 2;
const MAX_THINKING_CHARS = 6000;

type NativeComponent = Component & {
	children?: NativeComponent[];
	entries?: Array<{ component: NativeComponent }>;
};

type AssistantContentMessage = Parameters<AssistantMessageComponent["updateContent"]>[0];

type NativeAssistantState = {
	lastMessage?: AssistantContentMessage;
	isStreaming?: boolean;
	contentContainer?: Container;
	markdownTheme?: ConstructorParameters<typeof AssistantMessageComponent>[2];
	hiddenThinkingLabel?: string;
	outputPad?: number;
	markdownTransformers?: ConstructorParameters<typeof AssistantMessageComponent>[5];
};

type NativeToolState = {
	result?: { content?: Array<{ type: string; text?: string }> };
	toolName?: string;
};

type AssistantSnapshot = {
	text: string[];
	stopReason: AssistantContentMessage["stopReason"];
	errorMessage: AssistantContentMessage["errorMessage"];
	isStreaming: boolean | undefined;
};

function assistantSnapshot(message: AssistantContentMessage, state: NativeAssistantState): AssistantSnapshot {
	return {
		text: message.content.filter((part) => part.type === "text").map((part) => part.text),
		stopReason: message.stopReason,
		errorMessage: message.errorMessage,
		isStreaming: state.isStreaming,
	};
}

function sameAssistantSnapshot(left: AssistantSnapshot, right: AssistantSnapshot): boolean {
	return (
		left.stopReason === right.stopReason &&
		left.errorMessage === right.errorMessage &&
		left.isStreaming === right.isStreaming &&
		left.text.length === right.text.length &&
		left.text.every((text, index) => text === right.text[index])
	);
}

class MeasurementSafeVStack extends VStack {
	override render(_width: number): string[] {
		return [];
	}
}

function recentToolText(content: Array<{ type: string; text?: string }>, maxChars: number): string {
	const chunks: string[] = [];
	let remaining = maxChars;
	for (let index = content.length - 1; index >= 0 && remaining > 0; index--) {
		const part = content[index];
		if (part?.type !== "text" || !part.text) continue;
		const text = part.text.slice(-remaining);
		chunks.unshift(text);
		remaining -= text.length;
	}
	return chunks.join("\n");
}

class TranscriptProjection implements Component {
	private clones = new WeakMap<
		object,
		{
			snapshot: AssistantSnapshot;
			markdownTheme: ConstructorParameters<typeof AssistantMessageComponent>[2] | undefined;
			outputPad: number | undefined;
			markdownTransformers: ConstructorParameters<typeof AssistantMessageComponent>[5] | undefined;
			clone: AssistantMessageComponent;
		}
	>();

	private replacementScrollView: ScrollView | undefined;

	constructor(
		private readonly document: Container,
		private readonly chat: Container,
		private readonly nativeScrollView: ScrollView,
	) {}

	setReplacementScrollView(scrollView: ScrollView): void {
		this.replacementScrollView = scrollView;
	}

	invalidate(): void {
		this.document.invalidate();
		this.clones = new WeakMap();
	}

	render(width: number): string[] {
		if (
			this.replacementScrollView &&
			this.replacementScrollView.scrollbar !== this.nativeScrollView.scrollbar
		)
			this.replacementScrollView.setScrollbar(this.nativeScrollView.scrollbar);

		const lines: string[] = [];
		for (const documentChild of this.document.children as NativeComponent[]) {
			if (documentChild !== this.chat) {
				lines.push(...documentChild.render(width));
				continue;
			}
			for (const child of this.chat.children as NativeComponent[]) {
				if (child instanceof ToolExecutionComponent) continue;
				if (child instanceof AssistantMessageComponent) {
					const assistant = child as unknown as NativeAssistantState;
					const message = assistant.lastMessage;
					if (!message) continue;
					const content = message.content.filter(
						(part: { type: string }) => part.type !== "thinking" && part.type !== "toolCall",
					);
					const hasText = content.some(
						(part: { type: string; text?: string }) => part.type === "text" && part.text?.trim(),
					);
					if (!hasText && !["length", "error", "aborted"].includes(message.stopReason)) continue;
					const snapshot = assistantSnapshot(message, assistant);
					let cached = this.clones.get(child);
					if (
						!cached ||
						!sameAssistantSnapshot(cached.snapshot, snapshot) ||
						cached.markdownTheme !== assistant.markdownTheme ||
						cached.outputPad !== assistant.outputPad ||
						cached.markdownTransformers !== assistant.markdownTransformers
					) {
						const filtered = { ...message, content };
						const clone = new AssistantMessageComponent(
							filtered,
							true,
							assistant.markdownTheme,
							assistant.hiddenThinkingLabel,
							assistant.outputPad,
							assistant.markdownTransformers,
						);
						clone.updateContent(filtered, assistant.isStreaming);
						cached = {
							snapshot,
							markdownTheme: assistant.markdownTheme,
							outputPad: assistant.outputPad,
							markdownTransformers: assistant.markdownTransformers,
							clone,
						};
						this.clones.set(child, cached);
					}
					lines.push(...cached.clone.render(width));
					continue;
				}
				lines.push(...child.render(width));
			}
		}
		return lines;
	}
}

class ActivityPanel implements Component {
	constructor(
		private readonly title: string,
		private readonly getBody: (width: number) => string[],
	) {}

	invalidate(): void {}

	render(width: number): string[] {
		if (width < 2) return Array(PANEL_HEIGHT).fill("");
		const inside = width - 2;
		const title = truncateToWidth(` ${this.title} `, Math.max(1, inside), "");
		const top = `┌${title}${"─".repeat(Math.max(0, inside - visibleWidth(title)))}┐`;
		const body = this.getBody(Math.max(1, inside))
			.slice(-PANEL_BODY_HEIGHT)
			.map((line) => {
				const content = truncateToWidth(line, inside, "");
				return `│${content}${" ".repeat(Math.max(0, inside - visibleWidth(content)))}│`;
			});
		while (body.length < PANEL_BODY_HEIGHT) body.unshift(`│${" ".repeat(inside)}│`);
		return [top, ...body, `└${"─".repeat(inside)}┘`];
	}
}

function nativeTranscriptParts(
	root: Component,
): { chat: Container; document: Container; scrollView: ScrollView; dock: Component } | undefined {
	const rootEntries = (root as NativeComponent).entries;
	const scrollView = rootEntries?.[0]?.component;
	const dock = rootEntries?.[1]?.component;
	const document = scrollView?.children?.[0];
	const chat = document?.children?.[2];
	if (
		rootEntries?.length !== 2 ||
		!(scrollView instanceof ScrollView) ||
		!(chat instanceof Container) ||
		!(document instanceof Container) ||
		document.children.length < 3 ||
		!dock
	)
		return undefined;
	return { chat, document, scrollView, dock };
}

/** Replaces only Pi's transcript projection; session entries and native message components remain untouched. */
export function createThinkingToolPanelLayout(
	onUnsupportedLayout?: () => void,
): (root: Component) => Component {
	const layouts = new WeakMap<Component, Component>();
	let reportedUnsupportedLayout = false;
	return (root) => {
		const cached = layouts.get(root);
		if (cached) return cached;
		const parts = nativeTranscriptParts(root);
		if (!parts) {
			if (!reportedUnsupportedLayout) {
				reportedUnsupportedLayout = true;
				onUnsupportedLayout?.();
			}
			return root;
		}

		const projection = new TranscriptProjection(parts.document, parts.chat, parts.scrollView);
		const transcript = new ScrollView(projection, {
			follow: "end",
			primary: true,
			overscroll: "chain",
			...(parts.scrollView.scrollbar ? { scrollbar: parts.scrollView.scrollbar } : {}),
			scrollbarStyle: parts.scrollView.scrollbarStyle,
		});
		projection.setReplacementScrollView(transcript);

		const thinkingPanel = new ActivityPanel("Thinking", (width) => {
			const chunks: string[] = [];
			let remaining = MAX_THINKING_CHARS;
			let messagesSeen = 0;
			const children = parts.chat.children as NativeComponent[];
			for (let index = children.length - 1; index >= 0 && remaining > 0 && messagesSeen < 40; index--) {
				const child = children[index];
				if (!(child instanceof AssistantMessageComponent)) continue;
				messagesSeen++;
				const message = (child as unknown as NativeAssistantState).lastMessage;
				if (!message) continue;
				for (
					let contentIndex = message.content.length - 1;
					contentIndex >= 0 && remaining > 0;
					contentIndex--
				) {
					const part = message.content[contentIndex];
					if (part?.type !== "thinking" || !part.thinking.trim()) continue;
					const text = part.thinking.trim().slice(-remaining);
					chunks.unshift(text);
					remaining -= text.length;
				}
			}
			return wrapTextWithAnsi(chunks.join("\n\n"), width);
		});
		const toolsPanel = new ActivityPanel("Tool usage", (width) => {
			const tools: ToolExecutionComponent[] = [];
			const children = parts.chat.children as NativeComponent[];
			for (
				let index = children.length - 1;
				index >= 0 && tools.length < 3 && index >= children.length - 48;
				index--
			) {
				const child = children[index];
				if (child instanceof ToolExecutionComponent) tools.unshift(child);
			}
			return tools.flatMap((tool) => {
				const state = tool as unknown as NativeToolState;
				if (state.result?.content?.some((part) => part.type === "image")) {
					const text = recentToolText(state.result.content, 1200);
					return [
						`${state.toolName ?? "Tool"}: image output omitted`,
						...wrapTextWithAnsi(text, width).slice(-3),
					];
				}
				return tool.render(width).slice(-4);
			});
		});
		const band = new HStack([
			{ component: thinkingPanel, basis: 0, grow: 1, shrink: 1, minSize: 1 },
			{ component: toolsPanel, basis: 0, grow: 1, shrink: 1, minSize: 1 },
		]);
		const layout = new MeasurementSafeVStack([
			{ component: band, basis: PANEL_HEIGHT, grow: 0, shrink: 1, minSize: 5 },
			{ component: transcript, basis: 0, grow: 1, shrink: 1, minSize: 1 },
			{ component: parts.dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
		]);
		layouts.set(root, layout);
		return layout;
	};
}
