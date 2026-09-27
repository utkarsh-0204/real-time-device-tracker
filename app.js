const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const socketio = require("socket.io");
const http = require("http");
const path = require("path");

const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", function (socket) {
  console.log("connected:", socket.id);

  socket.on("send-location", function (data) {
    io.emit("receive-location", {
      id: socket.id,
      ...data,
    });
  });

  socket.on("disconnect", function () {
    console.log("disconnected:", socket.id);

    io.emit("user-disconnected", socket.id);
  });
});

app.get("/", function (req, res) {
  res.render("index");
});

server.listen(port, "0.0.0.0", function () {
  console.log(`Server running on port ${port}`);
});
