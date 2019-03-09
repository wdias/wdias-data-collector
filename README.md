# wdias-data-collector
Kubernetes nodes and pods data collection for analysys.

# Installation
-  Go to the Web Server `cd web` and build with `npm run build`
- Go helm-chart dir `cd ./helm`
- Build and deploy into K8s with `wdias build & wdias helm_install`
  - `wdias` refer to `wdias="~/wdias/wdias/bin/macos/dev"` from [wdias](https://github.com/wdias/wdias)
- Make sure `metrics-server` is running on the K8s with `minikube addons enable metrics-server`
  - List addons with `minikube addons list`
- Create a cluster role for default name space with `kubectl create clusterrolebinding default-cluster-admin --clusterrole=cluster-admin --serviceaccount=default:default`

Access the API with `http://analysis-api.wdias.com/metrics`.