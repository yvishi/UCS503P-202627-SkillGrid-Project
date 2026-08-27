SHELL           := /usr/bin/bash

### ---------------------------------------------------
### Make Documentation
### ---------------------------------------------------
PYTHONPATH	:= $${PYTHONPATH}:$${PWD}:$${PWD}/src

mkdocs		:= mkdocs

docserve :
	PYTHONPATH=$(PYTHONPATH) $(mkdocs) serve --livereload

docbuild :
	PYTHONPATH=$(PYTHONPATH) $(mkdocs) build

docs : docserve
### ---------------------------------------------------
