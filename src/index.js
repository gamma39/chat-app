const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const {  addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')


const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.json())
const port = process.env.PORT
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
       const { error, user } = addUser({ id: socket.id, ...options })

       if (error) {
            return callback(error)
       }

        socket.join(user.room)

        //send message to one user
        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        //send message to everyone expect user who triggers message
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    //send message to everyone 
    socket.on('sendMessage', (clientMessage, callback) => {
        const user = getUser(socket.id)
        //filter out profanity using bad-words npm package
        const filter = new Filter()
        if (filter.isProfane(clientMessage)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, clientMessage))
        callback()
    })

    //send location to all users
    socket.on('sendLocation', (position, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('location-message', generateLocationMessage(user.username, `https://google.com/maps?q=${position.latitude},${position.longitude}`))
        callback()
    })

    //code to run when client is disconnected
    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left.`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
        
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}.`)
})