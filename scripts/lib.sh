#!/bin/sh
# Fonctions communes aux scripts du pipeline. A inclure avec :  . "$(dirname "$0")/lib.sh"
# Compatible sh (dash du conteneur Jenkins) et ash (Alpine).

# Pauses (en secondes) entre deux tentatives : 1 essai + 1 reprise par pause = 4 essais au total.
# Surchargeable : RETRY_DELAYS="2 4" sh scripts/x.sh
RETRY_DELAYS="${RETRY_DELAYS:-5 15 30}"

# Affiche une erreur et arrete le script.
fail() {
    echo "ERREUR : $*" >&2
    exit 1
}

# retry <libelle> <commande...>
# Rejoue la commande avec une attente croissante. Ne l'utiliser que sur des commandes
# qui peuvent etre rejouees sans risque (lecture, clone, push, telechargement).
# Le code de retour est celui du dernier essai.
retry() {
    _label=$1
    shift
    _n=1
    for _delay in $RETRY_DELAYS; do
        if "$@"; then
            return 0
        fi
        echo "[reprise] ${_label} : echec (essai ${_n}), nouvel essai dans ${_delay} s..." >&2
        sleep "$_delay"
        _n=$((_n + 1))
    done
    echo "[reprise] ${_label} : dernier essai (${_n})." >&2
    "$@"
}

# git_auth_env <utilisateur> <token>
# Configure git pour s'authentifier en HTTPS via des variables d'environnement :
# rien n'est ecrit sur disque ni visible dans la liste des arguments.
# lowSpeed : un reseau bloque fait echouer git en 30 s au lieu de pendre.
git_auth_env() {
    GIT_CONFIG_COUNT=3
    GIT_CONFIG_KEY_0="http.extraheader"
    GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $(printf '%s:%s' "$1" "$2" | base64 | tr -d '\n')"
    GIT_CONFIG_KEY_1="http.lowSpeedLimit"
    GIT_CONFIG_VALUE_1="1000"
    GIT_CONFIG_KEY_2="http.lowSpeedTime"
    GIT_CONFIG_VALUE_2="30"
    export GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 \
           GIT_CONFIG_KEY_1 GIT_CONFIG_VALUE_1 GIT_CONFIG_KEY_2 GIT_CONFIG_VALUE_2
}

# read_tag : lit la valeur de la ligne "newTag:" d'un fichier kustomization (entree standard).
read_tag() {
    sed -n -E 's/^[[:space:]]*newTag:[[:space:]]*([^[:space:]]+).*/\1/p'
}

# require_env <NOM...> : echoue si une variable d'environnement obligatoire est vide.
require_env() {
    for _name in "$@"; do
        eval "_value=\${$_name:-}"
        [ -n "$_value" ] || fail "variable d'environnement ${_name} manquante"
    done
}
