#node-pogo-map

## Getting Started

Install nodejs & MongoDB.

```
sudo npm install -g grunt gulp bower nodemon forever typescript tsc typings tslint
typings install
npm install
```

## Setting Up MongoDB

```
# create database and create a user with full access to this database
use clairvoyance
db.createUser(
  {
    user: "clairvoyance",
    pwd: "clairvoyance",
    roles: [
		{ role: "readWrite", db: "clairvoyance" }
	]
  }
)
```