#!/bin/sh
# Publie l'image sur GHCR. Le login et le push sont rejouables sans risque.
#
# Entrees : IMAGE_NAME, RELEASE_VERSION, GH_USER, GH_TOKEN (token GHCR, write:packages)

set -u
. "$(dirname "$0")/lib.sh"

require_env IMAGE_NAME RELEASE_VERSION GH_USER GH_TOKEN

login() {
    printf '%s' "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
}

# La deconnexion est faite quoi qu'il arrive
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

retry "connexion a GHCR" login || fail "connexion a GHCR impossible"
retry "push de l'image" docker push "${IMAGE_NAME}:${RELEASE_VERSION}" || fail "push de ${IMAGE_NAME}:${RELEASE_VERSION} impossible"
