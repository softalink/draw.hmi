#!/bin/bash
# The image's entrypoint writes js/PreConfig.js from the DRAWIO_* variables
# on every start. Run it first, then append the draw.hmi loader, which
# registers the plugin as "hmi" (?p=hmi) and, with DRAWIO_HMI_AUTOLOAD, loads
# it on every page.
/docker-entrypoint.sh true

PRECONFIG=$CATALINA_HOME/webapps/draw/js/PreConfig.js

if [ -w "$PRECONFIG" ]; then
    if [ "${DRAWIO_HMI_AUTOLOAD:-true}" = "true" ]; then
        echo "window.DRAWIO_HMI_AUTOLOAD = true;" >> "$PRECONFIG"
    fi

    cat $CATALINA_HOME/webapps/draw/plugins/draw.hmi/preconfig.js >> "$PRECONFIG"
else
    echo "WARNING: cannot write $PRECONFIG; draw.hmi is not registered"
fi

exec "$@"
