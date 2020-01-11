#!/bin/sh

if test "${APPNAME}" = "api"; then
    ./main
elif test "${APPNAME}" = "web"; then
    npx serve -s build -l 8082
else
    echo "invalid APPNAME value: ${APPNAME}; should be web or api"
    exit 1
fi
