# Pi Atelier (status rows fork)

This repo is a hard fork of [Pi Atelier](https://github.com/michaelmjhhhh/pi-atelier). It carries one change on top of upstream: extension statuses render on dedicated rows beneath the status rail instead of inline in it.

## The status rows change

Extension statuses no longer share the status rail row. Each status stays whole and occupies rows beneath the rail:

- Statuses wrap onto further rows until every status displays
- A status wider than the terminal truncates with an ellipsis
- The rail row never drops statuses or compacts to make room for them
- The composer header and telemetry row keep upstream behavior

Install, configuration, usage, and troubleshooting are unchanged: see the [upstream README](https://github.com/michaelmjhhhh/pi-atelier#readme).
