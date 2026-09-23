import fs from 'fs';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import { execFile } from 'child_process';
import webp from 'node-webpmux';
import path from 'path';
import sharp from 'sharp';

const temp = process.platform === 'win32' ? process.env.TEMP : tmpdir();

const FILTER_ANIMATED = "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=000000 [p]; [b][p] paletteuse";

const randomName = (ext) => path.join(temp, `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`);

const unlink = (file) => fs.promises.unlink(file).catch(() => {});

function toBuffer(data) {
	if (Buffer.isBuffer(data)) return data;
	if (data instanceof Uint8Array) return Buffer.from(data);
	if (data?.data) return toBuffer(data.data);
	return Buffer.from(data || []);
}

function detectMime(buf) {
	if (!buf || buf.length < 12) return '';
	if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
		buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
	if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
	if (buf.slice(4, 8).toString() === 'ftyp') return 'video/mp4';
	return '';
}

async function toWebpWithFfmpeg(data, extraArgs = [], ext = 'png') {
	const tmpFileIn = randomName(ext);
	const tmpFileOut = randomName('webp');

	await fs.promises.writeFile(tmpFileIn, data);

	try {
		await new Promise((resolve, reject) => {
			execFile('ffmpeg', ['-y', '-i', tmpFileIn, '-vcodec', 'libwebp', '-vf', FILTER_ANIMATED, ...extraArgs, '-f', 'webp', tmpFileOut], (err) => {
				if (err) return reject(err);
				resolve(true);
			});
		});

		return await fs.promises.readFile(tmpFileOut);
	} finally {
		await Promise.all([unlink(tmpFileIn), unlink(tmpFileOut)]);
	}
}

export async function imageToWebp(media) {
	const data = toBuffer(media);
	try {
		return await sharp(data)
			.resize(512, 512, {
				fit: 'contain',
				background: { r: 0, g: 0, b: 0, alpha: 0 }
			})
			.webp({ quality: 80 })
			.toBuffer();
	} catch (e) {
		return await toWebpWithFfmpeg(data, ['-threads', '2', '-quality', '75'], 'png');
	}
}

export async function videoToWebp(media) {
	const data = toBuffer(media);
	return await toWebpWithFfmpeg(
		data,
		['-threads', '2', '-loop', '0', '-ss', '00:00:00', '-t', '00:00:05', '-preset', 'default', '-an', '-vsync', '0'],
		'mp4'
	);
}

export async function writeExif(media, metadata = {}) {
	const rawData = toBuffer(media);
	const mime = (typeof media === 'object' && !Buffer.isBuffer(media) && !(media instanceof Uint8Array) ? media?.mimetype : '') || detectMime(rawData);

	const isWebp = /webp/.test(mime);
	const isImage = /image/.test(mime);
	const isVideo = /video/.test(mime);

	let wMedia;
	if (isWebp) {
		try {
			const meta = await sharp(rawData).metadata();
			if ((!meta.pages || meta.pages <= 1) && (meta.width !== 512 || meta.height !== 512)) {
				wMedia = await sharp(rawData)
					.resize(512, 512, {
						fit: 'contain',
						background: { r: 0, g: 0, b: 0, alpha: 0 }
					})
					.webp({ quality: 80 })
					.toBuffer();
			} else {
				wMedia = rawData;
			}
		} catch {
			wMedia = rawData;
		}
	} else if (isImage) {
		wMedia = await imageToWebp(rawData);
	} else if (isVideo) {
		wMedia = await videoToWebp(rawData);
	} else {
		try {
			wMedia = await imageToWebp(rawData);
		} catch {
			throw new Error(`Mimetype tidak didukung untuk sticker: ${mime}`);
		}
	}

	const packId = metadata?.packId || `takav2-${Date.now()}`;
	const packName = metadata?.packName || global.stick || 'takav2';
	const packPublish = metadata?.packPublish || global.author || 'takav2';
	const emojis = Array.isArray(metadata?.emojis) && metadata.emojis.length ? metadata.emojis : ['😋', '😎', '🤣', '😂', '😁'];

	const json = {
		'sticker-pack-id': packId,
		'sticker-pack-name': packName,
		'sticker-pack-publisher': packPublish,
		emojis
	};

	if (metadata?.androidApp) json['android-app-store-link'] = metadata.androidApp;
	if (metadata?.iOSApp) json['ios-app-store-link'] = metadata.iOSApp;
	if (metadata?.isAvatar) json['is-avatar-sticker'] = 1;

	const exifAttr = Buffer.from([
		0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
		0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x16, 0x00, 0x00, 0x00
	]);
	const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
	const exif = Buffer.concat([exifAttr, jsonBuff]);
	exif.writeUIntLE(jsonBuff.length, 14, 4);

	const img = new webp.Image();
	await img.load(wMedia);
	img.exif = exif;

	return await img.save(null);
}

export async function toSticker(buffer, mimetype = 'image/jpeg', metadata = {}) {
	const buf = toBuffer(buffer);
	const mime = mimetype || buffer?.mimetype || detectMime(buf) || 'image/jpeg';
	return await writeExif({ data: buf, mimetype: mime }, metadata);
}

export async function toStickerWebp(buffer) {
	const data = toBuffer(buffer);
	try {
		return await sharp(data)
			.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.webp({ quality: 80 })
			.toBuffer();
	} catch {
		return data;
	}
}

export async function toTrayPng(buffer) {
	const data = toBuffer(buffer);
	try {
		return await sharp(data)
			.resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png()
			.toBuffer();
	} catch {
		return data;
	}
}

export async function toCoverJpeg(buffer) {
	const data = toBuffer(buffer);
	try {
		return await sharp(data)
			.resize(252, 252, { fit: 'cover' })
			.jpeg({ quality: 85 })
			.toBuffer();
	} catch {
		return data;
	}
}
