package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kataras/iris"
	_ "github.com/mattn/go-sqlite3"
	chart "github.com/wcharczuk/go-chart"
	"github.com/wcharczuk/go-chart/util"
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

func getMetrics(clientset *kubernetes.Clientset, pods *PodMetricsList) error {
	data, err := clientset.RESTClient().Get().AbsPath("apis/metrics.k8s.io/v1beta1/pods").DoRaw()
	if err != nil {
		return err
	}
	err = json.Unmarshal(data, &pods)
	return err
}

func getPodsPerMinute(db *sql.DB) {
	// Query
	rows, err := db.Query("SELECT timestamp, helmChart, count(name) as noPods FROM metrics GROUP BY timestamp, helmChart")
	if err != nil {
		fmt.Println("Unable to query data.", err.Error())
	}
	defer rows.Close()

	for rows.Next() {
		var timestamp time.Time
		var helmChart string
		var noPods int8
		err = rows.Scan(&timestamp, &helmChart, &noPods)
		if err != nil {
			fmt.Println("Unable to read data.", err.Error())
			continue
		}
		fmt.Println("row:", timestamp, helmChart, noPods)
	}
}

func main() {
	app := iris.Default()

	app.Get("/metrics", func(ctx iris.Context) {
		graph := chart.Chart{
			XAxis: chart.XAxis{
				Style:        chart.StyleShow(),
				TickPosition: chart.TickPositionBetweenTicks,
				ValueFormatter: func(v interface{}) string {
					typed := v.(float64)
					typedDate := util.Time.FromFloat64(typed)
					return fmt.Sprintf("%d:%d", typedDate.Hour(), typedDate.Minute())
				},
			},
			YAxis: chart.YAxis{
				Style: chart.Style{Show: false},
			},
			YAxisSecondary: chart.YAxis{
				Style: chart.StyleShow(),
			},
			Series: []chart.Series{
				chart.ContinuousSeries{
					XValues: []float64{1.0, 1.0, 1.0, 1.0, 1.0},
					YValues: []float64{10.0, 20.0, 30.0, 40.0, 50.0},
				},
				chart.ContinuousSeries{
					YAxis:   chart.YAxisSecondary,
					XValues: []float64{1.0, 2.0, 3.0, 4.0, 5.0},
					YValues: []float64{50.0, 40.0, 30.0, 20.0, 10.0},
				},
				chart.ContinuousSeries{
					YAxis:   chart.YAxisSecondary,
					XValues: []float64{1.0, 2.0, 3.0, 4.0, 5.0},
					YValues: []float64{30.0, 30.0, 20.0, 10.0, 10.0},
				},
				chart.ContinuousSeries{
					YAxis:   chart.YAxisSecondary,
					XValues: []float64{1.0, 2.0, 3.0, 4.0, 5.0},
					YValues: []float64{5.0, 15.0, 20.0, 40.0, 100.0},
				},
			},
		}

		ctx.Header("Content-Type", "image/png")
		graph.Render(chart.PNG, ctx)
	})

	app.Get("/public/hc", func(ctx iris.Context) {
		ctx.JSON(iris.Map{
			"message": "OK",
		})
	})
	// listen and serve on http://0.0.0.0:8080.
	go app.Run(iris.Addr(":8080"))

	db, err := sql.Open("sqlite3", "./wdias.db")
	if err != nil {
		fmt.Println("Unable to create Database. Exit.", err.Error())
		return
	}
	defer db.Close()
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS metrics (
		name VARCHAR(64) NULL, 
		namespace VARCHAR(64) NULL, 
		timestamp DATE NULL,
		helmChart VARCHAR(64) NULL,
		cpu VARCHAR(20) NULL,
		memory VARCHAR(20) NULL,
		PRIMARY KEY (name, timestamp)
	)`)
	if err != nil {
		fmt.Println("Unable to create table. Exit.", err.Error())
		return
	}
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
		fmt.Println("Fetch data on ", time.Now().String())
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
			fmt.Println(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp.String())
			c := m.Containers[0]
			_, err = stmt.Exec(m.Metadata.Name, m.Metadata.Namespace, m.Timestamp, c.Name, c.Usage.CPU, c.Usage.Memory)
			if err != nil {
				fmt.Println("Unable to insert data.", err.Error())
				continue
			}
		}
		getPodsPerMinute(db)

		time.Sleep(56 * time.Second)
	}
}
