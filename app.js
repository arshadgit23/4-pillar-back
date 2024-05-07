const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');
const User = require('./models/userModel');

const AppError = require('./utils/appError');
const userRouter = require('./routes/userRoutes');
const gratitudeRouter = require('./routes/gratitudeRoutes');
const journalRouter = require('./routes/journalRoutes');

// Start express app
// const app = express();
const app = require('express')();
const http = require('http').Server(app);
const io = require('./utils/socket').init(http);

app.enable('trust proxy');

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// PUG CONFIG
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// EJS CONFIG
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public', '/templates'));

// 1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));

// Set security HTTP headers
// app.use(helmet());
app.use(helmet.frameguard({ action: 'SAMEORIGIN' }));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Category.updateMany({},{isDeleted:false}).then((rs) => console.log('Inserted !!'));

app.use(compression());

// 3) ROUTES
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to 4-Pillar APIs',
  });
});

app.use('/api/v1/users', userRouter);
app.use('/api/v1/gratitude', gratitudeRouter);
app.use('/api/v1/journal', journalRouter)

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});



exports.http = http;
