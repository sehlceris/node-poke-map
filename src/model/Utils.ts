export default class Utils {

	static getGyms() {
		if (!gyms) {
			gyms = JSON.parse((fs.readFileSync(Constants.GYMS_JSON_PATH)));
		}
		return gyms;
	}
}