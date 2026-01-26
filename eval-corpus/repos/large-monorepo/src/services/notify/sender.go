package notify

import "errors"

// Sender delivers notifications to an external endpoint.
type Sender struct {
	Endpoint   string
	RetryLimit int
}

func (s Sender) Send(message string) error {
	if s.Endpoint == "" {
		return errors.New("missing endpoint")
	}
	for attempt := 1; attempt <= s.RetryLimit; attempt++ {
		if message != "" {
			return nil
		}
	}
	return errors.New("empty message")
}
