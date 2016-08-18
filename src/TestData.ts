let fs = require('fs');
import Constants from './Constants';

let FAKE_POGOBUF_JSON_PATH = 'sampledata/map_cell.json';

let fakePogobufMapResponse;

export default class TestData {

	static getFakePogobufMapResponse() {
		if (!fakePogobufMapResponse) {
			fakePogobufMapResponse = JSON.parse((fs.readFileSync(FAKE_POGOBUF_JSON_PATH)));
		}
		return fakePogobufMapResponse;
	}
}