#node-pogo-map

WARNING: The contents of this repository are outdated and no longer work. It is published just for review purposes.

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

# ensure index on your database so that Pokemon can be quickly found using their disappearTime
db.Pokemon.ensureIndex({
    "disappearTime": 1
})
db.SimulatedPokemon.ensureIndex({
   "disappearTime": 1
})
db.Pokemon.ensureIndex({
    "disappearTimeMs": 1
})
db.SimulatedPokemon.ensureIndex({
   "disappearTimeMs": 1
})
```

## Starting Up

* Put TBTerra's spawnScan's output JSON in the `data` folder, with the same filenames as were output
* Create `config.json` and `workers.json` (refer to the examples)
* Run `grunt dist` to build the project
* Run `node build/ElevationMapper.js` to inject elevations into your spawnpoint data (and output a new file)
* Run `node build/Clairvoyance.js` to start the scanner

## Developing

* Do the starting up stuff
* Run `grunt build` if you just want to recompile the TypeScript files every time you make a change, or...
* Run `grunt build` to automatically start/restart the scanner every time you change a file

## To Do/Current Limitations

* The `www` directory is automatically served, but the map it uses is basically an old version of the (pretty good) PokemonGo-map UI with a few shunts to make it work. It would be much better if we could integrate something like Meteor into it
* It does not scan/update gyms or pokestops.
* The event for a Pokemon scan does not check for whether a PKMN is new - that means that the SlackBot alerts multiple times for the same Poke.
* It doesn't do its own spawnpoint scanning; it relies on TBTerra's spawnScan to build the initial spawnpoints
* It's kind of inefficient
* Health check every 60 seconds is pretty stupid, could fire a workerBanned event or something like that instead
* Fuzzing of position is pretty haphazard, fuzzing of lat/long for example is different depending on where you are in the world, would be better if we fuzz by meters instead of lat/long
