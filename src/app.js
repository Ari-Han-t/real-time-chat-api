const express = require('express');
const app=express();
app.get('/',(req,res)=>{
    res.json({message:"Backend is running"});
});
module.exports=app;

const authRoutes = require("./routes/auth.routes");
app.use("/auth", authRoutes);
