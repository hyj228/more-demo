/*
 * @Author: your name
 * @Date: 2021-05-07 10:44:17
 * @LastEditTime: 2021-05-07 16:04:48
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: /一些demo/XX和XX的区别/util.js
 */
const request = require("request");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const debug = (msg) => {
  console.log(msg, "debug_msg");
};

class Downloader {
  constructor(url, filename, options) {
    this.options = Object.assign(
      {
        concurrency: 4,
        thread_memery: 1073741824, //1g
        continuingly: true, //breakpoint_continuingly
        tmpdir: os.tmpdir(),
        progress_throttle: 2000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.87 Safari/537.36",
        },
      },
      options
    );
    this.url = url;
    this.filename = filename;
    this.filekey = crypto.createHash("md5").update(url).digest("hex");
  }
  // 获取文件信息
  async getRemoteFileInfo() {
    let nothing = {
      length: 0,
      type: "",
    };
    return new Promise((resolve) => {
      let r = request(this.url, {
        headers: this.options.headers,
      })
        .on("response", (response) => {
          r.abort();
          if (response.statusCode == 200) {
            let contentLength = parseInt(response.headers["content-length"]);
            let contentType = response.headers["content-type"];
            let acceptRange = response.headers["accept-ranges"];
            resolve({
              length: contentLength,
              type: contentType,
              range: acceptRange,
            });
          } else resolve(nothing);
        })
        .on("error", function (err) {
          resolve(nothing);
        });
    });
  }

  async getTaskInfo() {
    return new Promise((resolve) => {
      if (this.options.continuingly) {
        fs.exists(this.task_file_path, (exists) => {
          if (exists) {
            fs.readFile(this.task_file_path, "utf8", async (err, data) => {
              if (err || !data) {
                resolve();
              } else {
                try {
                  let threads_info = JSON.parse(data);
                  let ps = await Promise.all(
                    Object.keys(threads_info).map((x) => {
                      return this.checkThreadFile(threads_info, x);
                    })
                  );
                  resolve(threads_info);
                } catch (e) {
                  resolve();
                }
              }
            });
          } else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async checkThreadFile(threads_info, thread_key) {
    let thread_info = threads_info[thread_key];
    let threadFilePath = path.resolve(this.options.tmpdir, thread_key);
    console.log(threadFilePath, "threadFilePath");
    if (thread_info["progress"] <= 0) {
      return thread_info["progress"];
    } else {
      return new Promise((resolve, reject) => {
        fs.exists(threadFilePath, (exists) => {
          if (exists) {
            fs.stat(threadFilePath, (err, stat) => {
              if (err || !stat) {
                debug(thread_key + " file stat error.");
                thread_info["progress"] = 0;
              } else {
                let asize = thread_info["end"] - thread_info["start"] + 1;
                if (stat["size"] != asize) {
                  debug(
                    thread_key +
                      " file size not corrent. " +
                      asize +
                      " actually " +
                      stat["size"]
                  );
                  thread_info["progress"] = 0;
                }
              }
              resolve(thread_info["progress"]);
            });
          } else {
            debug(thread_key + " not exists.");
            thread_info["progress"] = 0;
            resolve(thread_info["progress"]);
          }
        });
      });
    }
  }

  async saveTaskInfo() {
    return new Promise((resolve) => {
      let data = JSON.stringify(this.threads_info);
      fs.writeFile(this.task_file_path, data, "utf8", resolve);
    });
  }

  async genThreadsInfo() {
    let _threads_info = await this.getTaskInfo();
    if (_threads_info) {
      this.threads_info = _threads_info;
    } else {
      let avglen = Math.ceil(this.filesize / this.threads_count);
      this.threads_info = new Array(this.threads_count)
        .fill(0)
        .reduce((dct, itm, idx) => {
          let k = this.key + "-" + idx;
          dct[k] = {
            key: k,
            start: idx * avglen,
            end: Math.min(this.filesize - 1, (idx + 1) * avglen - 1),
            progress: 0,
          };
          return dct;
        }, {});
    }
  }

  onProgress(fn) {
    this.progressFunction = fn;
  }

  updateProgress() {
    let ct = 0;
    let total = 0;
    for (let k of Object.keys(this.threads_info)) {
      ct++;
      total += this.threads_info[k]["progress"];
    }
    this.progress = total / ct;
    return this.progress;
  }

  async threadsDownload() {
    let livethread = 0;
    return new Promise((resolve) => {
      for (let k of Object.keys(this.threads_info)) {
        let thread_info = this.threads_info[k];
        if (thread_info["progress"] < 1) {
          let threadFilePath = path.resolve(this.options.tmpdir, k);
          var arg = [
            k,
            this.url,
            threadFilePath,
            thread_info["start"].toString(),
            thread_info["end"].toString(),
            this.options.progress_throttle.toString(),
            JSON.stringify(this.options.headers),
          ];
          let thread = cp.fork(path.resolve(__dirname, "sub-download.js"), arg);
          console.log(thread, "thread");
          thread.on("message", (m) => {
            if (m["progress"]) {
              thread_info["progress"] = m["progress"]["percent"];
              //this.saveTaskInfo();
              if (this.progressFunction)
                this.progressFunction(
                  this.updateProgress(),
                  this.threads_info,
                  m
                );
            } else if (m["finish"]) {
              if (!m["err"]) {
                thread_info["progress"] = 1;
                this.saveTaskInfo();
              }
            }
          });

          thread.on("close", (m) => {
            livethread--;
            if (livethread <= 0) {
              if (this.updateProgress() == 1) resolve(true);
              else resolve(false);
            }
          });
          livethread++;
        }
      }
      if (livethread == 0) resolve(true);
    });
  }
  // 文件写入
  async mergeThreadFiles() {
    fs.createWriteStream(this.filename).end();
    let ptasks = [];
    let ftasks = [this.removeFile(this.task_file_path)];
    for (let k of Object.keys(this.threads_info)) {
      let thread_info = this.threads_info[k];
      let threadFilePath = path.resolve(this.options.tmpdir, k);
      ptasks.push(this.mergeFile(threadFilePath, thread_info["start"]));
      ftasks.push(this.removeFile(threadFilePath));
    }

    let bool = false;
    try {
      await Promise.all(ptasks);
      bool = true;
      await Promise.all(ftasks);
    } catch (e) {
      debug("merge thread files error: " + e);
    }

    return bool;
  }

  async mergeFile(threadFilePath, start_pos) {
    let readStream = fs.createReadStream(threadFilePath);
    let offset = start_pos;
    return new Promise((resolve, reject) => {
      readStream
        .on("data", (data) => {
          let ws = fs.createWriteStream(this.filename, {
            flags: "r+",
            start: offset,
          });
          ws.write(data);
          ws.end();
          offset += data.length;
        })
        .on("error", (err) => {
          reject(err);
        })
        .on("end", (_) => {
          resolve();
        });
    });
  }

  async removeFile(fpath) {
    return new Promise((resolve) => {
      fs.unlink(fpath, (err) => {
        if (err) debug("remove " + fpath + " err: " + err);
        resolve();
      });
    });
  }

  async download() {
    let fileInfo = await this.getRemoteFileInfo();
    console.log(fileInfo, "fileInfo");
    if (fileInfo["length"] <= 0) return null;
    else {
      let threads_by_length = Math.ceil(
        fileInfo["length"] / this.options["thread_memery"]
      );
      this.threads_count = fileInfo["range"]
        ? Math.max(threads_by_length, this.options["concurrency"])
        : 1;
      this.filesize = fileInfo["length"];
      this.key = this.filekey + "-" + this.threads_count;
      this.task_file_path = path.resolve(this.options.tmpdir, this.key);

      await this.genThreadsInfo();
      let dok = await this.threadsDownload();
      if (dok) {
        dok = await this.mergeThreadFiles();
      }
      console.log(dok, "dok");
      return dok;
    }
  }
}
module.exports = Downloader;
