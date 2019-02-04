package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	"github.com/kataras/iris"
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

func getMetrics(clientset *kubernetes.Clientset, pods *PodMetricsList) error {
	data, err := clientset.RESTClient().Get().AbsPath("apis/metrics.k8s.io/v1beta1/pods").DoRaw()
	if err != nil {
		return err
	}
	err = json.Unmarshal(data, &pods)
	return err
}

func getDistinctColumnValues(column string, db *sql.DB) []string {
	rows, err := db.Query(fmt.Sprint("SELECT DISTINCT ", column, " FROM metrics"))
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

func getDistinctTimestamps(db *sql.DB) []string {
	rows, err := db.Query(fmt.Sprint("SELECT DISTINCT timestamp FROM metrics"))
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

func getPodsPerHelmChartForGivenMin(timestamp string, db *sql.DB) []PodPerHelmChart {
	rows, err := db.Query(fmt.Sprint("SELECT helmChart, count(name) as noPods FROM metrics WHERE timestamp = '", timestamp, "' GROUP BY helmChart"))
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
func serve() {
	cmd := exec.Command("npx", "serve", "-s", "build", "-l", "8082")
	fmt.Println("Running command and waiting for it to finish...")
	err := cmd.Run()
	fmt.Println("Command finished with error: %v", err)
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

	app.Get("/metrics", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		timestamps := getDistinctTimestamps(db)
		// helmCharts := getDistinctColumnValues("helmChart", db)
		var podsPerTimestamp []PodPerTimestamp
		for _, timestamp := range timestamps {
			podsPerHelmChart := getPodsPerHelmChartForGivenMin(timestamp, db)
			podsPerTimestamp = append(podsPerTimestamp, PodPerTimestamp{Timestamp: timestamp, PodsPerHelmChart: podsPerHelmChart})
		}
		ctx.JSON(podsPerTimestamp)
	})

	app.Get("/metrics/helmCharts", func(ctx iris.Context) {
		ctx.Header("Access-Control-Allow-Origin", "*")
		helmCharts := getDistinctColumnValues("helmChart", db)
		ctx.JSON(helmCharts)
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
	go serve()

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
			c := m.Containers[0]
			fmt.Println(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp.Format("2006-01-02T15:04:05Z"), c.Name, c.Usage.CPU, c.Usage.Memory)
			_, err = stmt.Exec(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp.Format("2006-01-02T15:04:05Z"), c.Name, c.Usage.CPU, c.Usage.Memory)
			if err != nil {
				fmt.Println("Unable to insert data.", err.Error())
				continue
			}
		}

		time.Sleep(56 * time.Second)
	}
}
