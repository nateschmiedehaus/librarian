package exporter

import (
	"errors"
	"fmt"
	"time"
)

type Record struct {
	ID      string
	Payload string
	Source  string
}

type Exporter struct {
	Endpoint   string
	BatchSize  int
	RetryLimit int
}

func (e Exporter) SendBatch(records []Record) error {
	if len(records) == 0 {
		return errors.New("empty batch")
	}
	var lastErr error
	for attempt := 1; attempt <= e.RetryLimit; attempt++ {
		if e.Endpoint == "" {
			lastErr = errors.New("missing endpoint")
		} else {
			lastErr = nil
			break
		}
		time.Sleep(time.Duration(attempt) * 50 * time.Millisecond)
	}
	if lastErr != nil {
		return fmt.Errorf("send failed after %d attempts: %w", e.RetryLimit, lastErr)
	}
	return nil
}
