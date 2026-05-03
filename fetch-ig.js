import fs from 'fs';
import path from 'path';
import https from 'https';

const datasetUrl = 'https://api.apify.com/v2/datasets/r0ZVoCtCqRc5syPuy/items?format=json';
const assetsDir = path.join(process.cwd(), 'public', 'assets', 'ig');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // follow redirect
                https.get(response.headers.location, (redirectRes) => {
                    redirectRes.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => reject(err));
                });
            } else {
                reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function main() {
    console.log('Fetching dataset from Apify...');
    const res = await fetch(datasetUrl);
    const data = await res.json();
    
    const contentList = [];
    
    for (let i = 0; i < data.length; i++) {
        const post = data[i];
        if (!post.displayUrl) continue;
        
        const isVideo = post.type === 'Video';
        const mediaUrl = isVideo && post.videoUrl ? post.videoUrl : post.displayUrl;
        const ext = isVideo ? '.mp4' : '.jpg';
        const filename = `${post.shortCode || i}${ext}`;
        const dest = path.join(assetsDir, filename);
        
        console.log(`Downloading ${filename}...`);
        try {
            await download(mediaUrl, dest);
            
            contentList.push({
                id: post.id,
                type: post.type,
                shortCode: post.shortCode,
                caption: post.caption,
                mediaPath: `./assets/ig/${filename}`,
                likesCount: post.likesCount,
                commentsCount: post.commentsCount,
                timestamp: post.timestamp
            });
        } catch (err) {
            console.error(`Failed to download ${filename}:`, err);
        }
    }
    
    fs.writeFileSync(path.join(process.cwd(), 'public', 'content.json'), JSON.stringify(contentList, null, 2));
    console.log('Finished downloading media and generated content.json');
}

main();
