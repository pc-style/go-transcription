package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

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

type wsWriter struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (w *wsWriter) write(messageType int, payload []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn.WriteMessage(messageType, payload)
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, relying on environment variables")
	}

	apiKey := os.Getenv("deepgram_api_key")
	if apiKey == "" {
		log.Fatal("deepgram_api_key is required")
	}

	port := os.Getenv("port")
	if port == "" {
		port = "8080"
	}

	dg := deepgram.NewClient(apiKey)

	r := gin.Default()
	r.Use(cors.Default())

	r.Static("/static", "./static")
	r.GET("/", func(c *gin.Context) {
		c.File("./static/index.html")
	})
	r.StaticFile("/favicon.ico", "./static/favicon.ico")
	r.GET("/ws", liveTranscribe(dg))

	log.Printf("starting server on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func liveTranscribe(dg *deepgram.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		options := deepgram.LiveTranscriptionOptions{
			Model:           "nova-2",
			Language:        "en-US",
			Punctuate:       true,
			Smart_format:    true,
			Interim_results: true,
			Encoding:        "opus",
			Channels:        1,
			Sample_rate:     48000,
		}

		dgConn, _, err := dg.LiveTranscription(options)
		if err != nil {
			log.Printf("unable to connect to deepgram: %v", err)
			_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"Unable to connect to Deepgram"}`))
			return
		}
		defer dgConn.Close()

		writer := &wsWriter{conn: conn}
		done := make(chan struct{})

		go func() {
			defer close(done)
			for {
				messageType, message, err := dgConn.ReadMessage()
				if err != nil {
					log.Printf("error reading from deepgram: %v", err)
					return
				}
				if len(message) == 0 {
					continue
				}
				if err := writer.write(messageType, message); err != nil {
					log.Printf("error writing to websocket client: %v", err)
					return
				}
			}
		}()

		for {
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				log.Printf("client connection closed: %v", err)
				break
			}

			switch messageType {
			case websocket.CloseMessage:
				return
			case websocket.TextMessage:
				var payload map[string]string
				if err := json.Unmarshal(message, &payload); err != nil {
					continue
				}
				if payload["event"] == "stop" {
					break
				}
			case websocket.BinaryMessage:
				if len(message) == 0 {
					continue
				}
				if err := dgConn.WriteMessage(websocket.BinaryMessage, message); err != nil {
					log.Printf("error forwarding audio to deepgram: %v", err)
					return
				}
			}
		}

		_ = dgConn.WriteMessage(websocket.TextMessage, []byte(`{"type":"CloseStream"}`))
		_ = dgConn.Close()

		select {
		case <-done:
		case <-time.After(500 * time.Millisecond):
		}
	}
}
