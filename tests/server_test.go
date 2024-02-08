package tests

import (
	"testing"

	"github.com/haj300/whenwhatwhere/server"
)

func TestHello(t *testing.T) {
	got := server.Hello("katja")
	want := "Hello, katja"

	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}
