#!/bin/sh
# Signe l'image (par son digest) avec Cosign. La signature est aussi poussee sur GHCR.
# Pas de reprise automatique : on ne rejoue pas une signature a l'aveugle.
#
# Entrees : IMAGE_NAME, RELEASE_VERSION, COSIGN_IMAGE,
#           COSIGN_KEY (fichier de cle), COSIGN_PASSWORD, GH_USER, GH_TOKEN

set -u
. "$(dirname "$0")/lib.sh"

require_env IMAGE_NAME RELEASE_VERSION COSIGN_IMAGE COSIGN_KEY COSIGN_PASSWORD GH_USER GH_TOKEN

DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "${IMAGE_NAME}:${RELEASE_VERSION}" | cut -d@ -f2)
[ -n "$DIGEST" ] || fail "digest introuvable pour ${IMAGE_NAME}:${RELEASE_VERSION} (l'image est-elle publiee ?)"

# Le conteneur Cosign voit le volume jenkins_home sous /jenkins_home
COSIGN_KEY_CONTAINER="/jenkins_home${COSIGN_KEY#/var/jenkins_home}"

docker run --rm \
    --user 0:0 \
    -e COSIGN_PASSWORD \
    -v jenkins_home:/jenkins_home:ro \
    "$COSIGN_IMAGE" \
    sign \
    --key "$COSIGN_KEY_CONTAINER" \
    --registry-username "$GH_USER" \
    --registry-password "$GH_TOKEN" \
    "${IMAGE_NAME}@${DIGEST}"
