package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"time"

	"github.com/kataras/iris"
	_ "github.com/mattn/go-sqlite3"
)

const (
	database      = "wdias"
	metricsServer = "http://metrics-server.default.svc.cluster.local"
	controlLoop   = 3
)

// Point : Data Point
type point struct {
	Time  string  `json:"time"`
	Value float64 `json:"value"`
}

// Timeseries : Timeseries
type timeseries struct {
	TimeseriesID   string `json:"timeseriesId"`
	ModuleID       string `json:"moduleId"`
	ValueType      string `json:"valueType"`
	ParameterID    string `json:"parameterId"`
	LocationID     string `json:"locationId"`
	TimeseriesType string `json:"timeseriesType"`
	TimeStepID     string `json:"timeStepId"`
}

func getTimeseries(timeseriesID string, metadata *timeseries) error {
	fmt.Println("URL:", fmt.Sprint(metricsServer, "/timeseries/", timeseriesID))
	response, err := netClient.Get(fmt.Sprint(metricsServer, "/timeseries/", timeseriesID))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return err
	}
	err = json.Unmarshal(body, &metadata)
	return err
}

var tr = &http.Transport{
	MaxIdleConns:       10,
	IdleConnTimeout:    30 * time.Second,
	DisableCompression: true,
	Dial: (&net.Dialer{
		Timeout: 5 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}
var netClient = &http.Client{
	Transport: tr,
	Timeout:   time.Second * 10,
}

func main() {
	app := iris.Default()

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
		PRIMARY KEY (name, timestamp)
	)`)
	if err != nil {
		fmt.Println("Unable to create table. Exit.", err.Error())
		return
	}

	for {
		time.Sleep(controlLoop * time.Second)
		fmt.Println("Fetch data on ", time.Now().String())
		stmt, err := db.Prepare("INSERT INTO metrics(name, namespace, timestamp) values(?,?,?)")
		if err != nil {
			fmt.Println("Unable to prepare insert data.", err.Error())
			continue
		}
		defer stmt.Close()
		_, err = stmt.Exec("adapter-scalar-77d6998d99-qp2zq", "default", "2019-01-30T14:03:00Z")
		if err != nil {
			fmt.Println("Unable to insert data.", err.Error())
			// continue
		}
		rows, err := db.Query("SELECT * FROM metrics")
		if err != nil {
			fmt.Println("Unable to query data.", err.Error())
			continue
		}
		defer rows.Close()

		for rows.Next() {
			var name string
			var namespace string
			var timestamp time.Time
			err = rows.Scan(&name, &namespace, &timestamp)
			if err != nil {
				fmt.Println("Unable to read data.", err.Error())
				continue
			}
			fmt.Println("row:", name, namespace, timestamp)
		}
	}
}
