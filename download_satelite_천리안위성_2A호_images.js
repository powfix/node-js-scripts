import http from 'http';
import fs from 'fs';
import moment, {Moment} from 'moment';
import PromisePool from 'es6-promise-pool';

let count: number = 0;
const time = moment('2020-07-28 00:00', 'YYYY-MM-DD HH:mm');
const currentTime = moment();

const downloadImage = (count: number, date: Moment, retryCount: number = 0, ignoreError: boolean = true): Promise => new Promise((resolve, reject) => {
	const task = () => new Promise((resolve1, reject1) => {
		const image_url: string = `http://www.weather.go.kr/repositary/image/sat/gk2a/KO/gk2a_ami_le1b_rgb-daynight_ko020lc_${time.format('YYYYMMDDHHmm')}.srv.png`;
		const file_name: string = `gk2a_ami_le1b_rgb-daynight_ko020lc_${time.format('YYYYMMDDHHmm')}.srv.png`;
		const directory = 'archives/satelite_천리안위성_2A호_images';
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
		const request = http.get(image_url, {},(response) => {
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

time.add(-2, 'minute');
const taskIterator = (): Promise => {
	if (moment(time).add(9, 'hour').isAfter(currentTime)) return null;
	return downloadImage(++count, time.add(2, 'minute'), 3, true);
}

new PromisePool(taskIterator, 4).start().then(() => {
	console.log('All task done');
	process.exit(0);
}, (error) => {
	console.error(error);
	process.exit(22);
});