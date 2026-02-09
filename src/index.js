import dotenv from 'dotenv';
dotenv.config({ path: './env' });
import { DB_NAME } from './constants.js';
import express from 'express'
import connectDB from './db/index.js';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT||3000;



const startserver = async()=>{
    await connectDB();

    app.listen(PORT,()=>{
        console.log(`server is running on port ${PORT}`);
        
    })
}
console.log('MONGODB_URI:',process.env.MONGODB_URI);
console.log('DB_NAME:',DB_NAME);
startserver();
















/*
import express from "express";
const app = express();

;( async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("ERROR: ",error);
            throw error
        })
        app.listen(proces.env.PORT,()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
            
        })
    } catch(error){
        console.error("ERROR: ",error);
        throw err
    }
})()
    */