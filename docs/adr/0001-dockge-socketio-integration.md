# Integrate through Dockge's Socket.IO interface

The server will connect to Dockge through its authenticated Socket.IO interface
and target operational UI parity. This preserves Dockge's management path and
agent routing without requiring direct Docker socket or stack-directory access;
the trade-off is dependence on an internal protocol and its limitations, so
supported versions and compatibility checks must be explicit. Broader Docker
administration and Dockge administration are outside the accepted initial scope.
