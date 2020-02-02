package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
	"strconv"

	"github.com/kataras/iris/v12"
	"github.com/kataras/iris/v12/context"
	_ "github.com/mattn/go-sqlite3"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	database    = "wdias"
	controlLoop = 3
)

// PodMetricsList : PodMetricsList
type PodMetricsList struct {
	Kind       string `json:"kind"`
	APIVersion string `json:"apiVersion"`
	Metadata   struct {
		SelfLink string `json:"selfLink"`
	} `json:"metadata"`
	Items []struct {
		Metadata struct {
			Name              string    `json:"name"`
			Namespace         string    `json:"namespace"`
			SelfLink          string    `json:"selfLink"`
			CreationTimestamp time.Time `json:"creationTimestamp"`
		} `json:"metadata"`
		Timestamp  time.Time `json:"timestamp"`
		Window     string    `json:"window"`
		Containers []struct {
			Name  string `json:"name"`
			Usage struct {
				CPU    string `json:"cpu"`
				Memory string `json:"memory"`
			} `json:"usage"`
		} `json:"containers"`
	} `json:"items"`
}

// PodPerHelmChart : Pods per HelmChart
type PodPerHelmChart struct {
	HelmChart string  `json:"helmChart"`
	NoPods    float64 `json:"noPods"`
}

// PodPerTimestamp : Pods per Timestamp
type PodPerTimestamp struct {
	Timestamp        string            `json:"timestamp"`
	PodsPerHelmChart []PodPerHelmChart `json:"podsPerHelmChart"`
}

// ResourcesPerPod : Resources per Pod
type ResourcesPerPod struct {
	PodName string `json:"podName"`
	CPU     string `json:"cpu"`
	Memory  string `json:"memory"`
}

// ResourcesPerPodPerHelmChart : Resources per Pod per HelmChart
type ResourcesPerPodPerHelmChart struct {
	HelmChart       string            `json:"helmChart"`
	ResourcesPerPod []ResourcesPerPod `json:"resourcesPerPod"`
}

// ResourcesPerPodPerHelmChartTimestamp : Resources per Pod per Timestamp
type ResourcesPerPodPerHelmChartTimestamp struct {
	Timestamp                   string                        `json:"timestamp"`
	ResourcesPerPodPerHelmChart []ResourcesPerPodPerHelmChart `json:"resourcesPerPodPerHelmChart"`
}

func getMetrics(clientset *kubernetes.Clientset, pods *PodMetricsList) error {
	data, err := clientset.RESTClient().Get().AbsPath("apis/metrics.k8s.io/v1beta1/pods").DoRaw()
	if err != nil {
		return err
	}
	err = json.Unmarshal(data, &pods)
	return err
}

func getDistinctColumnValues(column string, namespace string, db *sql.DB) []string {
	q := fmt.Sprint("SELECT DISTINCT ", column, " FROM metrics")
	if namespace != "" {
		q = fmt.Sprint(q, " WHERE namespace = '", namespace, "'")
	}
	rows, err := db.Query(q)
	if err != nil {
		fmt.Println("Unable to query data.", err.Error())
	}
	defer rows.Close()
	var values []string
	for rows.Next() {
		var value string
		err = rows.Scan(&value)
		if err != nil {
			fmt.Println("Unable to read data.", err.Error())
			continue
		}
		values = append(values, value)
	}
	return values
}

func getDistinctTimestamps(namespace string, db *sql.DB, start string, end string) (values []string, err error) {
	q := fmt.Sprint("SELECT DISTINCT timestamp FROM metrics")
	var whereCause []string
	if namespace != "" {
		whereCause = append(whereCause, fmt.Sprint("namespace = '", namespace, "'"))
	}
	if start != "" {
		_, err = time.Parse("2006-01-02T15:04:00Z", start)
		if err != nil {
			fmt.Println("Invalid start time.", err.Error())
			return
		}
		whereCause = append(whereCause, fmt.Sprint("'", start, "' <= timestamp"))
	}
	if end != "" {
		_, err = time.Parse("2006-01-02T15:04:00Z", end)
		if err != nil {
			fmt.Println("Invalid end time.", err.Error())
			return
		}
		whereCause = append(whereCause, fmt.Sprint("timestamp <= '", end, "'"))
	}
	if len(whereCause) > 0 {
		q = fmt.Sprint(q, " WHERE ", strings.Join(whereCause, " AND "))
	}
	rows, err := db.Query(q)
	if err != nil {
		fmt.Println("Unable to query data.", err.Error())
	}
	defer rows.Close()
	for rows.Next() {
		var value string
		err = rows.Scan(&value)
		if err != nil {
			fmt.Println("Unable to read data.", err.Error())
			continue
		}
		values = append(values, value)
	}
	return values, nil
}

func getPodsPerHelmChartForGivenMin(timestamp string, namespace string, db *sql.DB) []PodPerHelmChart {
	q := fmt.Sprint("SELECT helmChart, count(name) as noPods FROM metrics WHERE timestamp = '", timestamp, "'")
	if namespace != "" {
		q = fmt.Sprint(q, " AND namespace = '", namespace, "'")
	}
	q = fmt.Sprint(q, " GROUP BY helmChart")
	fmt.Println("getPodsPerHelmChartForGivenMin q:", q)
	rows, err := db.Query(q)
	if err != nil {
		fmt.Println("Unable to query data.", err.Error())
	}
	defer rows.Close()

	var podsPerHelmChart []PodPerHelmChart
	for rows.Next() {
		var helmChart string
		var noPods float64
		err = rows.Scan(&helmChart, &noPods)
		if err != nil {
			fmt.Println("Unable to read data.", err.Error())
			continue
		}
		podsPerHelmChart = append(podsPerHelmChart, PodPerHelmChart{HelmChart: helmChart, NoPods: noPods})
	}
	return podsPerHelmChart
}

func getResourcesPerPodPerHelmChartForGivenMin(timestamp string, namespace string, db *sql.DB) []ResourcesPerPodPerHelmChart {
	q := fmt.Sprint("SELECT helmChart, name as podName, cpu, memory FROM metrics WHERE timestamp = '", timestamp, "'")
	if namespace != "" {
		q = fmt.Sprint(q, " AND namespace = '", namespace, "'")
	}
	q = fmt.Sprint(q, " ORDER BY helmChart")
	fmt.Println("getResourcesPerPodPerHelmChartForGivenMin q:", q)
	rows, err := db.Query(q)
	if err != nil {
		fmt.Println("Unable to query data.", err.Error())
	}
	defer rows.Close()

	var resourcesPerPodsPerHelmChart []ResourcesPerPodPerHelmChart
	prevHelmChart := ""
	hasPrevious := false
	var resourcesPerPod []ResourcesPerPod
	for rows.Next() {
		var helmChart string
		var podName string
		var cpu string
		var memory string
		err = rows.Scan(&helmChart, &podName, &cpu, &memory)
		if err != nil {
			fmt.Println("Unable to read data.", err.Error())
			continue
		}
		if prevHelmChart == "" {
			resourcesPerPod = append(resourcesPerPod, ResourcesPerPod{PodName: podName, CPU: cpu, Memory: memory})
			prevHelmChart = helmChart
			continue
		}
		if prevHelmChart == helmChart {
			resourcesPerPod = append(resourcesPerPod, ResourcesPerPod{PodName: podName, CPU: cpu, Memory: memory})
			hasPrevious = true
		} else {
			resourcesPerPodsPerHelmChart = append(resourcesPerPodsPerHelmChart, ResourcesPerPodPerHelmChart{HelmChart: prevHelmChart, ResourcesPerPod: resourcesPerPod})
			resourcesPerPod = []ResourcesPerPod{}
			resourcesPerPod = append(resourcesPerPod, ResourcesPerPod{PodName: podName, CPU: cpu, Memory: memory})
			hasPrevious = false
		}
		prevHelmChart = helmChart
		// resourcesPerPodsPerHelmChartTimestamp = append(resourcesPerPodsPerHelmChartTimestamp, PodPerHelmChart{HelmChart: helmChart, NoPods: noPods})
	}
	if hasPrevious {
		resourcesPerPodsPerHelmChart = append(resourcesPerPodsPerHelmChart, ResourcesPerPodPerHelmChart{HelmChart: prevHelmChart, ResourcesPerPod: resourcesPerPod})
	}
	return resourcesPerPodsPerHelmChart
}

func serve() {
	// https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b
	// With npx, run the package without installing on the package.json
	cmd := exec.Command("npx", "serve", "-s", "build", "-l", "8082")
	fmt.Println("Running command and waiting for it to finish...")
	err := cmd.Run()
	fmt.Println("Command finished with error: ", err.Error())
}

func main() {
	// Create SQLite DB
	db, err := sql.Open("sqlite3", "./wdias.db")
	if err != nil {
		fmt.Println("Unable to create Database. Exit.", err.Error())
		return
	}
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS metrics (
		name VARCHAR(64) NULL, 
		namespace VARCHAR(64) NULL, 
		timestamp VARCHAR(20) NULL,
		helmChart VARCHAR(64) NULL,
		cpu VARCHAR(20) NULL,
		memory VARCHAR(20) NULL,
		PRIMARY KEY (name, timestamp)
	)`)
	if err != nil {
		fmt.Println("Unable to create table. Exit.", err.Error())
		return
	}

	app := iris.Default()

	app.Get("/metrics/namespace/{namespace:string}", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		namespace := ctx.Params().Get("namespace")
		start := ctx.URLParamDefault("start", "")
		end := ctx.URLParamDefault("end", "")
		timestamps, err := getDistinctTimestamps(namespace, db, start, end)
		if err != nil {
			ctx.JSON(context.Map{"error": err.Error()})
			return
		}
		var podsPerTimestamp []PodPerTimestamp
		for _, timestamp := range timestamps {
			podsPerHelmChart := getPodsPerHelmChartForGivenMin(timestamp, namespace, db)
			podsPerTimestamp = append(podsPerTimestamp, PodPerTimestamp{Timestamp: timestamp, PodsPerHelmChart: podsPerHelmChart})
		}
		ctx.JSON(podsPerTimestamp)
	})

	app.Get("/metrics", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		start := ctx.URLParamDefault("start", "")
		end := ctx.URLParamDefault("end", "")
		timestamps, err := getDistinctTimestamps("", db, start, end)
		if err != nil {
			ctx.JSON(context.Map{"error": err.Error()})
			return
		}
		var podsPerTimestamp []PodPerTimestamp
		for _, timestamp := range timestamps {
			podsPerHelmChart := getPodsPerHelmChartForGivenMin(timestamp, "", db)
			podsPerTimestamp = append(podsPerTimestamp, PodPerTimestamp{Timestamp: timestamp, PodsPerHelmChart: podsPerHelmChart})
		}
		ctx.JSON(podsPerTimestamp)
	})

	app.Get("/metrics/namespace/{namespace:string}/helmCharts", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		namespace := ctx.Params().Get("namespace")
		helmCharts := getDistinctColumnValues("helmChart", namespace, db)
		ctx.JSON(helmCharts)
	})

	app.Get("/metrics/helmCharts", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		helmCharts := getDistinctColumnValues("helmChart", "", db)
		ctx.JSON(helmCharts)
	})

	app.Get("/metrics/namespace/{namespace:string}/resources", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		namespace := ctx.Params().Get("namespace")
		start := ctx.URLParamDefault("start", "")
		end := ctx.URLParamDefault("end", "")
		timestamps, err := getDistinctTimestamps(namespace, db, start, end)
		if err != nil {
			ctx.JSON(context.Map{"error": err.Error()})
			return
		}
		var resourcesPerPodsPerHelmChartTimestamp []ResourcesPerPodPerHelmChartTimestamp
		for _, timestamp := range timestamps {
			resourcesPerPodsPerHelmChart := getResourcesPerPodPerHelmChartForGivenMin(timestamp, namespace, db)
			resourcesPerPodsPerHelmChartTimestamp = append(resourcesPerPodsPerHelmChartTimestamp, ResourcesPerPodPerHelmChartTimestamp{Timestamp: timestamp, ResourcesPerPodPerHelmChart: resourcesPerPodsPerHelmChart})
		}
		ctx.JSON(resourcesPerPodsPerHelmChartTimestamp)
	})

	app.Get("/metrics/resources", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		start := ctx.URLParamDefault("start", "")
		end := ctx.URLParamDefault("end", "")
		timestamps, err := getDistinctTimestamps("", db, start, end)
		if err != nil {
			ctx.JSON(context.Map{"error": err.Error()})
			return
		}
		var resourcesPerPodsPerHelmChartTimestamp []ResourcesPerPodPerHelmChartTimestamp
		for _, timestamp := range timestamps {
			resourcesPerPodsPerHelmChart := getResourcesPerPodPerHelmChartForGivenMin(timestamp, "", db)
			resourcesPerPodsPerHelmChartTimestamp = append(resourcesPerPodsPerHelmChartTimestamp, ResourcesPerPodPerHelmChartTimestamp{Timestamp: timestamp, ResourcesPerPodPerHelmChart: resourcesPerPodsPerHelmChart})
		}
		ctx.JSON(resourcesPerPodsPerHelmChartTimestamp)
	})

	app.Get("/public/hc", func(ctx iris.Context) {
		ctx.JSON(iris.Map{
			"message": "OK",
		})
	})
	// listen and serve on http://0.0.0.0:8080.
	go app.Run(iris.Addr(":8080"))

	// Serve static files
	// app2 := iris.New()
	// app2.Favicon("./build/favicon.ico")
	// app2.StaticWeb("/static/css", "./build/static/css")
	// app2.StaticWeb("/static/js", "./build/static/js")
	// app2.StaticWeb("/web", "./build")
	// go app2.Run(iris.Addr(":8082"))
	// go serve() -> taking too much time. Run as another container

	// creates the in-cluster config
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	// creates the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	for {
		time.Sleep(controlLoop * time.Second)
		fmt.Println("\nFetch data on ", time.Now().String())
		stmt, err := db.Prepare("INSERT INTO metrics(name, namespace, timestamp, helmChart, cpu, memory) values(?,?,?,?,?,?)")
		if err != nil {
			fmt.Println("Unable to prepare insert data.", err.Error())
			continue
		}
		defer stmt.Close()
		var pods PodMetricsList
		err = getMetrics(clientset, &pods)
		if err != nil {
			fmt.Println("Unable to get metrics.", err.Error())
			continue
		}
		for _, m := range pods.Items {
			helmChart := m.Containers[0].Name
			cpu := 0
			memory := 0
			for _, c := range m.Containers {
				c1, err1 := strconv.Atoi(strings.TrimSuffix(c.Usage.CPU, "n"))
				mem1, err2 := strconv.Atoi(strings.TrimSuffix(c.Usage.Memory, "Ki"))
				if err1 == nil && err2 == nil {
					cpu += c1
					memory += mem1
				}
			}
			fmt.Println(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp.Format("2006-01-02T15:04:00Z"), helmChart, cpu, memory)
			_, err = stmt.Exec(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp.Format("2006-01-02T15:04:00Z"), helmChart, cpu, memory)
			if err != nil {
				fmt.Println("Unable to insert data.", err.Error())
				continue
			}
		}

		time.Sleep(30 * time.Second)
	}
}
