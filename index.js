const firebase = require('firebase')
const firebaseApp = firebase.initializeApp({
    apiKey: "AIzaSyC8qrCaodPbrJP-Y9G_He68veKjwmLPrW0",
    authDomain: "cinta-df473.firebaseapp.com",
    projectId: "cinta-df473",
    storageBucket: "cinta-df473.appspot.com",
    messagingSenderId: "688843608558",
    appId: "1:688843608558:web:b4cf77d181bda78c233eff"
});

require('dotenv').config();

const path = require('path')
const multer = require('multer')
const cors = require('cors')
const express = require('express')
const app = express()
const mcache = require('memory-cache');
const fileUpload = require('express-fileupload');
const port = process.env.PORT || 4999

const { Buffer } = require('buffer')

const AWS = require('aws-sdk')

const getImgBuffer = base64 => {
    const base64str = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64str, 'base64')
}

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env

AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: 'ap-south-1'
})

const s3Bucket = new AWS.S3({params: { Bucket: 'cinta-users' }})

const imageUpload = (path, buffer) => {
    const s3Url = "https://cinta-users.s3.ap-south-1.amazonaws.com/"
    const data = {
        Key: path,
        Body: buffer,
        ContentEncoding: "utf8",
    };
    return new Promise((resolve, reject) => {
        s3Bucket.putObject(data, (err) => {
            if(err) {
                reject(err)
            } else {
                // console.log(51,data)
                resolve(s3Url + path)
            }
        })
    })
}

const getImageUrl = async(type, base64Image) => {
    const buffer = getImgBuffer(base64Image)
    const currentTime = new Date().getTime()
    return imageUpload(`${type}/${currentTime}.jpeg`, buffer)
}

// const { Storage } = require('@google-cloud/storage');
// const storage = new Storage({
//     projectId: process.env.GCLOUD_PROJECT_ID,
//     keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
// });

// const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET_URL);

const bodyParser = require('body-parser')

app.use(cors())

app.use(bodyParser.urlencoded({
    extended: true
}))

app.use(bodyParser.json())

app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 20 * 1048576 } // 20 Mb 
}));
  

// //MULTER OPTIONS
// const upload = multer({
//     dest: 'images'
//     })

// app.use('/upload', express.static(path.join(__dirname, '/images')))

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'images');
//     },
//     filename: (req, file, cb) => {
//         console.log(file);
//         cb(null, Date.now() + path.extname(file.originalname));
//     }
// });

const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}
// const uploader = multer({ storage: multer.memoryStorage, fileFilter: fileFilter, limits: { fileSize: 5 * 1280 * 960 } });

const uploader = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // keep images size < 5 MB
    },
});

//UPLOAD IMAGE
app.post('/api/upload',  async(req, res) => {
    try {
        // let imageBuffer = req.files.image64.data
        const { image64 } = req.body

        let output = await getImageUrl('profileImages', image64)
        res.json({output})
        // if(req.files) {
        //     let output = await getImageUrl('profileImages', req.files.doc.data)
        // }

    } catch(err) {
        res.json(err)
    }
});

app.post('/api/uploadSecond',  async(req, res) => {
    try {
        // let imageBuffer = req.files.image64.data
        const { image64 } = req.body

        let output = await getImageUrl('profileImages', image64)
        res.json({output})
        // if(req.files) {
        //     let output = await getImageUrl('profileImages', req.files.doc.data)
        // }

    } catch(err) {
        res.json(err)
    }
});

//CREATE PROFILE API
app.post("/api/addProfile", (req, res) => {

    try {
        const { name, age, skills, profileImage, otherImage } = req.body
        const uniqueId = String(new Date().getTime())
    
        let reference = firebaseApp.firestore().collection("userData").doc(uniqueId).set({
            name,
            age,
            skills : skills.split(","),
            createdAt: uniqueId,
            profileImage,
            otherImage
        })
    
        res.json({message:"successfully added", data: {name, age, skills}})
    }catch(err) {
        res.json(err)
    }

})

// const cachedAPICallStorage = {}

// let memcached = new Memcached("localhost:11211")
const cache = (duration) => {
    return (req, res, next) => {
      let key = '__express__' + req.originalUrl || req.url
      let cachedBody = mcache.get(key)
    //   console.log(186,mcache.keys().slice(0))
      let allItems = mcache.keys()
      console.log(188,allItems.length)
      if (cachedBody) {
        res.send(cachedBody)
        return
      } else if(mcache.memsize > 100){
            mcache.keys().splice(0,50)
      } else {
        res.sendResponse = res.send
        res.send = (body) => {
          mcache.put(key, body, duration * 1000);
          res.sendResponse(body)
        }
        next()
      }
    }
  }


//GET SINGLE PROFILE
app.get("/api/getProfile",cache(300),async(req, res) => {
    try {
        const { uniqueId } = req.query
        console.log(136,req.protocol + '://' + req.get('host') + req.originalUrl)

        let output = []
        
        let reference = await firebaseApp.firestore().collection("userData").where("createdAt","==",uniqueId).get()
        reference.forEach(item => {
            output.push(item.data())
        })  

        res.json(output)
    }catch(err) {
        res.json(err)
    }
})

//GET ALL PROFILES
app.get("/api/getAllProfiles", async(req, res) => {
    try {
        let reference = await firebaseApp.firestore().collection("userData").get()
        const output = []

        reference.forEach(item => output.push(item.data()) )

        res.json(output)
    } catch(err) {
        res.json(err)
    }
})

//UPDATE USERDATA IN THE SERVER
app.post("/api/updateUserProfile", async(req, res) => {
    try {
        const { uniqueId, name, age, skills } = req.body
        console.log(uniqueId, name, age, skills)

        let reference = await firebaseApp.firestore().doc(`/userData/${uniqueId}`).update({
            name,
            age,
            skills: skills.split(",")
        })

        res.json("successfully updated")
    } catch(err) {
        res.json(err)
    }
})

//LISTENING TO API
app.listen(port, () => {
    console.log("Listening to port: ", port)
})