package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"

	"github.com/deepgram-devs/deepgram-go-sdk/deepgram"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024 * 8,
	WriteBufferSize: 1024 * 8,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	godotenv.Load()

	apiKey := os.Getenv("deepgram_api_key")
	if apiKey == "" {
		log.Fatal("deepgram_api_key environment variable must be set")
	}

	dg := deepgram.NewClient(apiKey)

	port := os.Getenv("port")
	if port == "" {
		port = "8080"
	}

	router := gin.Default()
	router.Use(cors.Default())
	router.Static("/", "./static")

	router.GET("/live", liveTranscriptionHandler(dg))

	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func liveTranscriptionHandler(dg *deepgram.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}
		clientConn.EnableWriteCompression(true)

		options := deepgram.LiveTranscriptionOptions{
			Language:        c.DefaultQuery("language", "en-US"),
			Encoding:        c.DefaultQuery("encoding", "opus"),
			Sample_rate:     queryInt(c, "sample_rate", 48000),
			Punctuate:       queryBool(c, "punctuate", true),
			Smart_format:    queryBool(c, "smart_format", true),
			Interim_results: queryBool(c, "interim_results", true),
		}

		if model := c.Query("model"); model != "" {
			options.Model = model
		}
		if tier := c.Query("tier"); tier != "" {
			options.Tier = tier
		}
		if queryBool(c, "diarize", true) {
			options.Diarize = true
		}

		deepgramConn, _, err := dg.LiveTranscription(options)
		if err != nil {
			log.Printf("unable to connect to Deepgram: %v", err)
			clientConn.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","message":"Unable to reach Deepgram"}`))
			clientConn.Close()
			return
		}

		if err := clientConn.WriteJSON(gin.H{"type": "connected"}); err != nil {
			log.Printf("failed to notify client of connection: %v", err)
		}

		var closeOnce sync.Once
		closeAll := func() {
			closeOnce.Do(func() {
				deepgramConn.Close()
				clientConn.Close()
			})
		}

		errors := make(chan error, 2)

		go func() {
			for {
				messageType, payload, err := clientConn.ReadMessage()
				if err != nil {
					errors <- err
					return
				}

				if err := deepgramConn.WriteMessage(messageType, payload); err != nil {
					errors <- err
					return
				}
			}
		}()

		go func() {
			for {
				messageType, payload, err := deepgramConn.ReadMessage()
				if err != nil {
					errors <- err
					return
				}

				if err := clientConn.WriteMessage(messageType, payload); err != nil {
					errors <- err
					return
				}
			}
		}()

		if err := <-errors; err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("live transcription closed with error: %v", err)
			}
		}

		closeAll()
	}
}

func queryBool(c *gin.Context, key string, defaultValue bool) bool {
	value := c.Query(key)
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}

	return parsed
}

func queryInt(c *gin.Context, key string, defaultValue int) int {
	value := c.Query(key)
	if value == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}

	return parsed
}
