# Dockge management

Terms established by Dockge's documentation and source. Tool names and project
policy remain part of the design interview.

## Language

**Stack**:
A named Compose application containing one or more services and their related resources.
_Avoid_: Swarm stack

**Service**:
A named component of a stack that can have one or more container instances.
_Avoid_: Container, when referring to the whole service

**Container**:
An individual instance of a service.
_Avoid_: Service, when referring to one specific instance

**Dockge agent**:
A Dockge instance that manages stacks on a Docker host and can be reached from another Dockge instance.
_Avoid_: AI agent

**Managed stack**:
A stack whose directory is available within the managing Dockge instance's stacks directory.

**Draft stack**:
A saved stack that has not been created as a Compose application.
