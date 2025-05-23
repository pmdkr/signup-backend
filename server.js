const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

// JWT Secret Key (should be in env variables in production)
const JWT_SECRET = 'mySuperSecretKey123';

// Azure SQL configuration
const sqlConfig = {
    user: 'pramod',
    password: '@Swasti123456',
    database: 'signupdb',
    server: 'mysignupserver.database.windows.net',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
    }
};

app.post('/travel-booking', async (req, res) => {
    const {
        fullName,
        email,
        phone,
        passportNumber,
        departureCountry,
        destinationCountry,
        travelDate,
        returnDate,
        travelType,
        travelers,
        travelClass,
        mealPreference,
        addOns, // array of selected add-ons
        paymentMethod,
        specialRequests
    } = req.body;

    if (
        !fullName || !email || !phone || !departureCountry ||
        !destinationCountry || !travelDate || !travelType ||
        !travelers || !travelClass || !paymentMethod
    ) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const pool = await sql.connect(sqlConfig);

        await pool.request()
            .input('fullName', sql.VarChar, fullName)
            .input('email', sql.VarChar, email)
            .input('phone', sql.VarChar, phone)
            .input('passportNumber', sql.VarChar, passportNumber)
            .input('departureCountry', sql.VarChar, departureCountry)
            .input('destinationCountry', sql.VarChar, destinationCountry)
            .input('travelDate', sql.Date, travelDate)
            .input('returnDate', sql.Date, returnDate || null)
            .input('travelType', sql.VarChar, travelType)
            .input('travelers', sql.Int, travelers)
            .input('travelClass', sql.VarChar, travelClass)
            .input('mealPreference', sql.VarChar, mealPreference || null)
            .input('addOns', sql.NVarChar, JSON.stringify(addOns || []))
            .input('paymentMethod', sql.VarChar, paymentMethod)
            .input('specialRequests', sql.Text, specialRequests || null)
            .query(`
                INSERT INTO travel_bookings (
                    full_name, email, phone, passport_number,
                    departure_country, destination_country, travel_date, return_date,
                    travel_type, travelers, travel_class, meal_preference,
                    add_ons, payment_method, special_requests
                ) VALUES (
                    @fullName, @email, @phone, @passportNumber,
                    @departureCountry, @destinationCountry, @travelDate, @returnDate,
                    @travelType, @travelers, @travelClass, @mealPreference,
                    @addOns, @paymentMethod, @specialRequests
                )
            `);

        res.status(201).json({
            message: 'Travel booking saved successfully',
            booking: {
                fullName,
                email,
                phone,
                passportNumber,
                departureCountry,
                destinationCountry,
                travelDate,
                returnDate,
                travelType,
                travelers,
                travelClass,
                mealPreference,
                addOns,
                paymentMethod,
                specialRequests
            }
        });
    } catch (err) {
        console.error('Travel booking error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});



// ✅ Contact Us API
app.post('/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Name, Email, and Message are required fields' });
    }

    try {
        const pool = await sql.connect(sqlConfig);

        await pool.request()
            .input('name', sql.VarChar, name)
            .input('email', sql.VarChar, email)
            .input('subject', sql.VarChar, subject || 'No Subject')
            .input('message', sql.VarChar, message)
            .query(`
                INSERT INTO contactData (name, email, subject, message)
                VALUES (@name, @email, @subject, @message)
            `);

        res.status(201).json({ message: 'Your message has been submitted successfully!' });
    } catch (error) {
        console.error('Contact API error:', error);
        res.status(500).json({ message: 'An error occurred while saving your message' });
    }
});

// ✅ Existing routes (kept as-is)
app.post('/signup', async (req, res) => {
    const { firstname, lastname, email, password, address, gender, country, dob } = req.body;

    if (!firstname || !lastname || !email || !password || !address || !gender || !country || !dob) {
        return res.status(400).json({ message: 'All fields including DOB are required' });
    }

    try {
        const pool = await sql.connect(sqlConfig);

        // Check if user already exists
        const checkResult = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM [user] WHERE email = @email');

        if (checkResult.recordset.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Insert new user
        await pool.request()
            .input('firstname', sql.VarChar, firstname)
            .input('lastname', sql.VarChar, lastname)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, password)
            .input('address', sql.VarChar, address)
            .input('gender', sql.VarChar, gender)
            .input('country', sql.VarChar, country)
            .input('dob', sql.Date, dob)
            .query(`
                INSERT INTO [user] (firstname, lastname, email, password, address, gender, country, dob)
                VALUES (@firstname, @lastname, @email, @password, @address, @gender, @country, @dob)
            `);

        // Fetch newly inserted user
        const newUserResult = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT * FROM [user] WHERE email = @email');

        const newUser = newUserResult.recordset[0];

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser.id, email: newUser.email, firstname: newUser.firstname },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: newUser
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// ✅ Login API with JWT Token Generation
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await sql.connect(sqlConfig);

        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, password)
            .query('SELECT * FROM [user] WHERE email = @email AND password = @password');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];

            // Generate JWT Token
            const token = jwt.sign(
                { userId: user.id, email: user.email, firstname: user.firstname },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ message: 'Login successful', token, user });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ✅ Protected route example
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access token missing' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: `Hello ${req.user.firstname}, this is a protected route.` });
});

// ✅ Root route
app.get('/', (req, res) => {
    res.json({ message: 'API is running' });
});

// ✅ Start the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
