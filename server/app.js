require('dotenv').config(); // Load environmental variables from .env file
var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

// Routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');

// Session storage
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

var app = express();
const port = process.env.PORT || 5000;

// MySQL session store configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Use session middleware
app.use(session({
  key: 'temp_data',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Set extended to true to handle complex data structures

// view engine setup changed from jade to pug
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(cors());
app.use(logger('dev'));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
  
module.exports = app;
