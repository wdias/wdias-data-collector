# wdias-data-collector
Kubernetes nodes and pods data collection for analysys.

# Installation
- Build the Web Server with `npm run build`
- Go helm-chart dir `cd ./helm`
- Build and deploy into K8s with `wdias build & wdias helm_install`
  - `wdias` refer to `wdias="~/wdias/wdias/bin/macos/dev"` from [wdias](https://github.com/wdias/wdias)
- Make sure `metrics-server` is running on the K8s with `minikube addons enable metrics-server`
  - List addons with `minikube addons list`