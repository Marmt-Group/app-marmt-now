import express from 'express'
import validator from 'validator'
import xssFilters from 'xss-filters'

const Mailjet = require('node-mailjet').connect(
    process.env.MAILJET_PUBLIC, //public key
    process.env.MAILJET_PRIVATE //private key
);

const app = express()

const validateAndSanitize = (key, value) => {
    const rejectFunctions = {
        name: v => v.length < 4,
        email: v => !validator.isEmail(v),
        company: v => v.length < 3,
        message: v => v.length < 25
    }

    // If object has key and function returns false, return sanitized input. Else, return false
    return rejectFunctions.hasOwnProperty(key) && !rejectFunctions[key](value) && xssFilters.inHTMLData(value)
}

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.json())

app.post('*', (req, res) => {
    const attributes = ['name', 'email', 'company', 'message']
    const sanitizedAttributes = attributes.map(n => validateAndSanitize(n, req.body[n]))
    const someInvalid = sanitizedAttributes.some(r => !r)
    const sendEmail = Mailjet.post('send');

    if (someInvalid) {
        return res.status(422).json({ 'error': 'Ugh.. That looks unprocessable!' })
    }

    const emailData = {
        'FromEmail': 'admin@marmt.io',
        'FromName': req.body.name,
        'Subject': 'New Marmot Inquiry from ' + req.body.company,
        'Text-part': req.body.message,
        'Html-part': '<p>' + req.body.message + '</p>',
        'Recipients': [{ 'Email': 'davidjamesdavis.djd@gmail.com', 'Name': 'David' }],
        "Headers": { "Reply-To": req.body.email }
    }

    const mailResponse = async () => {
        await sendEmail
            .request(emailData)
            .then((result) => {
                return res.status(200).send({ message: 'Email sent.' })
            }) 
            .catch((error) => {
                // Render error message
                console.error(error)
                return res.status(500).send(error)
            })
    }

    mailResponse()
})

app.all('*', (req, res) => {
    res.status(405).send({ error: 'only POST requests are accepted' })
})

export default app