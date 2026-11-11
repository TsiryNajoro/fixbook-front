#!/bin/sh
# Controle GitOps (lecture seule).
# Compare la release precedente de l'application avec le newTag present dans le depot GitOps.
#
# Entrees (variables d'environnement) :
#   APP_REPO_URL     depot applicatif (GitHub)
#   GITOPS_REPO_URL  depot GitOps (GitLab)
#   GITOPS_APP_FILE  fichier kustomization contenant "newTag:"
#   APP_TOKEN        token de lecture du depot applicatif
#   GITOPS_TOKEN     token de lecture du depot GitOps
#   RELEASE_VERSION  (facultatif) version creee par ce build, exclue de la "release precedente"
#   CHECK_TAG        (facultatif) version dont l'existence comme release doit etre verifiee
#
# Sorties (dans le dossier courant, le workspace) :
#   gitops-check.out   "PRECEDENTE|ACTUELLE|DERNIERE_MODIF"  (si le controle a abouti)
#   gitops-check.log   journal complet
#   gitops-check.tail  15 dernieres lignes du journal (pour le mail)
# Code de retour : 0 si le controle a abouti, 1 sinon. Ce script ne modifie rien.

set -u
. "$(dirname "$0")/lib.sh"

rm -f gitops-check.out gitops-check.log gitops-check.tail

clone_gitops() {
    rm -rf gitops-repo
    git clone -q "$GITOPS_REPO_URL" gitops-repo
}

# Le travail est fait dans un sous-shell dont toute la sortie va dans le journal.
# Attention : "set -e" est ignore dans un sous-shell appele avec "||" ; les erreurs
# sont donc testees explicitement.
check() {
    require_env APP_REPO_URL GITOPS_REPO_URL GITOPS_APP_FILE APP_TOKEN GITOPS_TOKEN || exit 1

    # 1) release precedente = tag le plus recent, hors celui de ce build
    git_auth_env x-access-token "$APP_TOKEN"
    TAGS=$(retry "lecture des tags" git ls-remote --tags --refs "$APP_REPO_URL" "refs/tags/v*") \
        || { echo "ERREUR : lecture des tags impossible sur ${APP_REPO_URL}"; exit 1; }
    PREVIOUS=$(printf '%s\n' "$TAGS" \
        | sed 's|.*refs/tags/||' \
        | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
        | grep -vx "${RELEASE_VERSION:-none}" \
        | sort -V | tail -1 || true)
    [ -n "$PREVIOUS" ] || PREVIOUS=none

    # Facultatif : CHECK_TAG doit etre une release existante (sert au job de reconciliation / rollback)
    if [ -n "${CHECK_TAG:-}" ]; then
        printf '%s\n' "$TAGS" | sed 's|.*refs/tags/||' | grep -qx "$CHECK_TAG" \
            || { echo "ERREUR : ${CHECK_TAG} n'est pas une release existante de ${APP_REPO_URL}"; exit 1; }
    fi

    # 2) version actuelle dans GitOps + dernier auteur de cette ligne
    # GitLab : le nom d'utilisateur est libre (non vide) avec un token d'acces
    git_auth_env oauth2 "$GITOPS_TOKEN"
    retry "clone du depot GitOps" clone_gitops \
        || { echo "ERREUR : clone du depot GitOps impossible"; exit 1; }
    COUNT=$(grep -Ec '^[[:space:]]*newTag:' "gitops-repo/${GITOPS_APP_FILE}" || true)
    [ "$COUNT" = "1" ] \
        || { echo "ERREUR : ${COUNT} ligne(s) newTag: dans ${GITOPS_APP_FILE} (une seule attendue)"; exit 1; }
    CURRENT=$(read_tag < "gitops-repo/${GITOPS_APP_FILE}")
    LASTCHANGE=$(git -C gitops-repo log -1 --date=short --format='%an, %ad, %s' -- "$GITOPS_APP_FILE" | tr -d '|\n')

    echo "${PREVIOUS}|${CURRENT}|${LASTCHANGE}" > gitops-check.out
}

ST=0
( check ) > gitops-check.log 2>&1 || ST=$?

cat gitops-check.log
tail -n 15 gitops-check.log > gitops-check.tail
exit "$ST"
