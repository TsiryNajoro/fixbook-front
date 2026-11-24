#!/bin/sh
# Run frontend tests in the Jenkins Node image with the workspace user's UID/GID.
# The integration mode runs the complete suite so it also writes coverage/lcov.info for Sonar.

set -eu
. "$(dirname "$0")/lib.sh"

MODE=${1:-}
case "$MODE" in
    unit|integration) ;;
    *) fail "usage: test.sh unit|integration" ;;
esac

require_env NODE_IMAGE WORKSPACE

# A previous release run may have left root-owned node_modules in the shared workspace.
docker run --rm \
    --user 0:0 \
    -v jenkins_home:/var/jenkins_home \
    -w "$WORKSPACE" \
    "$NODE_IMAGE" \
    sh -c 'rm -rf node_modules'

docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -e CI=true \
    -e NODE_ENV=test \
    -e VITE_API_URL= \
    -v jenkins_home:/var/jenkins_home \
    -w "$WORKSPACE" \
    "$NODE_IMAGE" \
    sh -eu -c '
        trap "rm -rf node_modules" EXIT
        npm ci
        case "$1" in
            unit) npm run test:unit ;;
            integration) npm test ;;
            *) echo "ERREUR: mode de test inconnu: $1" >&2; exit 2 ;;
        esac
    ' sh "$MODE"
