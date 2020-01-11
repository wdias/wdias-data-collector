# wdias-data-collector
Kubernetes nodes and pods data collection for analysys.

# Installation
- Go to the Web Server `cd web` and build with `npm run build`
- Go helm-chart dir `cd ./helm`
- Build and deploy into K8s with `wdias build ~/wdias/wdias-data-collector & wdias up helm/wdias-data-collector`
  - `wdias` refer to `wdias="~/wdias/wdias/bin/macos/dev"` from [wdias](https://github.com/wdias/wdias)

## Installation -> Minikube
- Make sure `metrics-server` is running on the K8s with `minikube addons enable metrics-server`
  - List addons with `minikube addons list`
- Create a cluster role for default name space with `kubectl create clusterrolebinding default-cluster-admin --clusterrole=cluster-admin --serviceaccount=default:default`

## Installation -> Metrics-Server
In order to install this service, need to install `metrics-server`. If you're using Docker-for-Mac or similar which doesn't have `metrics-server`, then need to install Metrics Server manually.

Access the API with `http://analysis-api.wdias.com/metrics`.

# Support
- `cd ~/wdias && wdias build wdias-data-collector && helm del --purge wdias-data-collector && wdias helm_install wdias-data-collector/helm/wdias-data-collector`
- `kubectl get pods --all-namespaces | grep 'wdias-data-collector' | grep 'Running' |  awk '{print $2}' | xargs kubectl logs -f --tail=20`

# Dev Guide
- Connect to running pod: `kubectl get pods | grep 'wdias-data-collector' | awk '{print $1}' | xargs -o -I {} kubectl exec -it {} -- /bin/sh`
- Connect to SQLLite DB - `sqllite3 wdias.db`
  - Cheet Sheet: `https://vicente-hernando.appspot.com/sqlite3-cheat-sheet`

# Trouble shooting
- [Update golang with Go modules](https://www.callicoder.com/docker-golang-image-container-example/)
- [Update k8s client-go](https://github.com/kubernetes/client-go/blob/master/INSTALL.md#go-modules)
