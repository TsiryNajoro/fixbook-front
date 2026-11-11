#!/bin/sh
# Execute A L'INTERIEUR du conteneur Node (Alpine), lance par release.sh.
#   sh -e scripts/release-inner.sh dry-run|publish
#
# Les installations (apk, npm ci) sont reprises avec attente : elles sont sans risque a rejouer.
# semantic-release lui-meme n'est JAMAIS rejoue automatiquement en mode publish :
# une publication a moitie faite ne doit pas etre relancee a l'aveugle.

set -eu
. "$(dirname "$0")/lib.sh"

MODE=${1:-}

retry "installation de git" apk add --no-cache git
git checkout -B main "$GIT_COMMIT"
retry "npm ci" npm ci

AUTH=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')
git config --local http.https://github.com/.extraheader "AUTHORIZATION: basic $AUTH"
trap 'git config --local --unset-all http.https://github.com/.extraheader || true' EXIT

if [ "$MODE" = "dry-run" ]; then
    # 2>&1 : le Jenkinsfile lit la version dans la sortie standard
    npx semantic-release --dry-run 2>&1
else
    npx semantic-release
    # Verification : le tag doit exister sur le depot distant
    retry "verification du tag" sh -c 'git ls-remote --tags origin "refs/tags/$RELEASE_VERSION" | grep -q "refs/tags/$RELEASE_VERSION"' \
        || fail "le tag ${RELEASE_VERSION} est absent apres la release"
fi
