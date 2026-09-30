# Unsupported features and uncertain outcomes

Proposal for Q8; not yet accepted by the owner. Distinguish a feature that the
known backend lacks from a request whose outcome is unknown after dispatch.

| Scenario | Proposed response | Suggested next action |
| --- | --- | --- |
| A caller asks for a service-only restart on stock 1.5.0, which lacks the master's `restartService` event. | Mark that feature unsupported for this profile before sending any mutation. | Use the supported whole-stack restart only if the caller chooses its broader effect, or later install/test a compatible profile. Do not restart the whole stack automatically. |
| A caller wants container CPU/memory stats on stock 1.5.0, which lacks `dockerStats`. | Report unavailable; do not return zeros or empty data as proof of no activity. | Continue using stack/service status supported by this release; consider a future profile for stats. |
| A configured source profile does not persist environment changes. | Reject the unsupported environment edit before sending it. | Use a tested release that persists `.env`, or address the upstream limitation. Never claim success or silently apply YAML while discarding requested environment changes. |
| An agent is offline before a mutation can be dispatched. | Return agent-unavailable, with no command sent. | Reconnect and verify the agent; caller can submit a new request once connectivity is restored. Other agents remain independently usable. |
| Connection disappears after `updateStack` was sent, before its completion ACK. | Report outcome-unknown, preserving whatever output was observed. This is not an unsupported feature or a confirmed failure. | Reconnect, refresh stack/service status, and inspect available logs; do not blindly replay the update. |
| Docker rejects a pull or deployment and Dockge returns an error. | Report command-failed with bounded diagnostic output and any known partial effects. | Address the reported registry/configuration problem; saved files or pulled images may already have changed. Do not claim rollback. |

Capabilities should be reported per agent/profile, because a primary and its
agents may run different builds. Known unsupported operations should fail before
dispatch. Read-only operations may be retried on reconnect; mutations that may
have been dispatched require reconciliation rather than automatic replay.

No hidden Docker socket, filesystem, or host-console fallback is proposed. Such
a fallback would need an explicit architectural change and a defined contract.
