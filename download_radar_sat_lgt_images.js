import https from 'https';
import fs from 'fs';
import moment, {Moment} from 'moment';
import PromisePool from 'es6-promise-pool';

let count: number = 0;
const time = moment('2020-07-21 09:30', 'YYYY-MM-DD HH:mm');
const currentTime = moment();

const downloadImage = (count: number, date: Moment, resolution: number = 1440, retryCount: number = 0, ignoreError: boolean = true): Promise => new Promise((resolve, reject) => {
	const task = () => new Promise((resolve1, reject1) => {
		const image_url: string = `https://www.weather.go.kr/cgi-bin/rdr_new/nph-rdr_sat_lgt_img?tm=${date.format('YYYYMMDDHHmm')}&sat=ir1&rdr=lng&map=HC&size=${resolution}&zoom_level=0&zoom_x=0000000&zoom_y=0000000&fog=0`;
		const file_name: string = `nph-rdr_sat_lgt_img_v3_${resolution}px_${time.format('YYYY_MM_DD_HHmm')}.png`;
		const directory = 'archives/radar_sat_lgt_images';
		const path = `${directory}/${file_name}`;

		if (!fs.existsSync(directory)) {
			fs.mkdirSync(directory, {recursive: true});
		}

		const isExists: boolean = fs.existsSync(path);
		if (isExists) {
			console.log(`[${count}] Skip already exists`, path);
			return resolve1();
		}

		console.log(`[${count}] Start task`, image_url);
		const request = https.get(image_url, {},(response) => {
			if (response.statusCode === 200) {
				const file = fs.createWriteStream(path);
				file.on('finish', function() {
					file.close();  // close() is async, call cb after close completes.
					console.info(`    => [${count}] Finish task`, image_url, response.statusCode);
					resolve1();
				});
				response.pipe(file);
				return;
			}

			reject1(response.statusCode);
		}).on('error', (err) => { // Handle errors
			console.warn('http request failed', image_url);
			fs.unlink(path, () => {
				console.log('Unlink complete', path);
				reject1(err);
			});
		});
	});

	const taskHandler = () => {
		task().then(() => {
			resolve();
		}).catch((error) => {
			if (retryCount > 0) {
				console.log(`[${count}] Retry(${retryCount}) task`, error);
				retryCount = retryCount - 1;
				setTimeout(() => {
					taskHandler();
				}, 500);
				return;
			}

			if (ignoreError) {
				resolve();
			} else {
				reject(error);
			}
		});
	};

	// Initial execution
	taskHandler();
});

time.add(-5, 'minute');
const taskIterator = (): Promise => {
	// if (time.year() !== 2020) return null;
	if (time.isAfter(currentTime)) return null;
	return downloadImage(++count, time.add(5, 'minute'), 1440, 3, true);
}

new PromisePool(taskIterator, 16).start().then(() => {
	console.log('All task done');
	process.exit(0);
}, (error) => {
	console.error(error);
	process.exit(22);
});