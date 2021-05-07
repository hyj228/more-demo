/*
 * @Author: your name
 * @Date: 2021-04-30 15:39:30
 * @LastEditTime: 2021-05-07 16:27:11
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /一些demo/XX和XX的区别/index.js
 */
// 更多查看
// https://juejin.cn/post/6956360277185003556
const Koa = require("koa");
const path = require("path");
const Downloader = require("./downloader");
const router = require("koa-router")();
const views = require("koa-views");
const Static = require("koa-static");
const request = require("request");
const fs = require("fs");
const WebSocket = require("ws");
const app = new Koa();
const publicSrc = path.join(__dirname, "/public/html");
const extractExt = (filename) => filename.slice(0, filename.lastIndexOf(".")); // 提取后缀名
app.use(Static(path.join(__dirname, "/public/assets")));
app.use(
  views(publicSrc, {
    extension: "html",
  })
);
const ws = new WebSocket.Server({
  port: 8000,
});

const fileArr = fs.readdirSync(publicSrc);
router.get(`/`, (ctx, next) => {
  ctx.body = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>demo</title></head>
        <body>${fileArr
          .map(
            (el) =>
              `<a href="/${encodeURI(extractExt(el))}">${extractExt(el)}</a>`
          )
          .join("<br/>")}</body>
      </html>
    `;
});

ws.on("connection", function (ws) {
  router.post("/file_down", async (ctx, next) => {
    ctx.body = { down: true };
    await next();
    let url =
      "https://api.dogecloud.com/player/get.mp4?vcode=5ac682e6f8231991&userId=17&ext=.mp4";
    let downloader = new Downloader(
      url,
      "/Users/huoyanjie/Downloads/video.mp4",
      {
        concurrency: 2,
        progress_throttle: 2000,
      }
    );
    downloader.onProgress((pct, tinfo, pinfo) => {
      // console.log(pct, tinfo, pinfo, "pct, tinfo, pinfo");
      ws.send(JSON.stringify({ pct, pinfo, tinfo }));
    });
    downloader.download().then((res) => {
      if (res) {
        ws.send(JSON.stringify({ pct: 1 }));
      }
    });
    // let down = await downloader.download();
    // if (down) {
    //   ws.send(JSON.stringify({ pct: 1 }));
    // }
  });
});

fileArr.forEach((el) => {
  router.get(`/${encodeURI(extractExt(el))}`, async (ctx, next) => {
    await ctx.render(el);
  });
});
app.use(router.routes()).use(router.allowedMethods());

app.listen(8080, () => {
  console.log("已经启动8080");
});
