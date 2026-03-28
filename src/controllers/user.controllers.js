import asyncHandler from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import fs from "fs/promises"

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)

    if (!user) {
      throw new ApiError(404, "User not found")
    }

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    throw new ApiError(500,error.message|| "Failed to generate authentication tokens")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body

  if ([fullName, email, username, password].some((field) => !field || field.trim() === "")) {
    throw new ApiError(400, "All required fields must be provided")
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (existedUser) {
    throw new ApiError(409, "User with provided email or username already exists")
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path

  let coverImageLocalPath
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image file is required")
  }

 let avatar
  try {
  avatar = await uploadOnCloudinary(avatarLocalPath)
} finally {
  await fs.unlink(avatarLocalPath).catch(()=>{})
}
  const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null
if (coverImageLocalPath) {
  await fs.unlink(coverImageLocalPath).catch(()=>{})
}
  if (!avatar || !avatar.url) {
    throw new ApiError(500, "Failed to upload avatar image")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select("-password -refreshToken")

  if (!createdUser) {
    throw new ApiError(500, "User registration failed. Please try again")
  }

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User registered successfully")
  )
})

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required")
  }

  if (!password) {
    throw new ApiError(400, "Password is required")
  }

  const user = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (!user) {
    throw new ApiError(404, "User not found")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials")
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV==="production",
    sameSite: "strict"
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser },
        "User logged in successfully"
      )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1
      }
    },
    { new: true }
  )

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV==="production",
    sameSite: "strict"
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is missing")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken?._id)

    if (!user) {
      throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token has expired or is invalid")
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV==="production",
      sameSite: "strict"
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { success:true},
          "Access token refreshed successfully"
        )
      )

  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body

  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new ApiError(400, "All password fields are required")
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New password and confirm password do not match")
  }

  const user = await User.findById(req.user?._id)

  if (!user) {
    throw new ApiError(404, "User not found")
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Current password is incorrect")
  }

  user.password = newPassword
  await user.save({ validateBeforeSave: false })

  return res.status(200).json(
    new ApiResponse(200, {}, "Password updated successfully")
  )
})

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, req.user, "User profile fetched successfully")
  )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body

  if (!fullName || !email) {
    throw new ApiError(400, "Full name and email are required")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email
      }
    },
    { new: true }
  ).select("-password")

  return res.status(200).json(
    new ApiResponse(200, user, "Account details updated successfully")
  )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  await fs.unlink(avatarLocalPath).catch(()=>{});

  if (!avatar || !avatar.url) {
    throw new ApiError(500, "Failed to upload avatar image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    { new: true }
  ).select("-password")

  return res.status(200).json(
    new ApiResponse(200, user, "Avatar updated successfully")
  )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is required")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  await fs.unlink(coverImageLocalPath).catch(()=>{})

  if (!coverImage || !coverImage.url) {
    throw new ApiError(500, "Failed to upload cover image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    { new: true }
  ).select("-password")

  return res.status(200).json(
    new ApiResponse(200, user, "Cover image updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username}=req.params

  if(!username?.trim()){
    throw new ApiError(400,"username is missing")
  }

  const channel = await User.aggregate([
    {
      $match:{
        username:username?.toLowerCase()
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      }
    },
    {
      $addFields:{
        subscribersCount:{
          $size:"$subscribers"
        },
        channelsSubscribedToCount:{
          $size:"$subscribedTo"
        },
        isSubscribed:{
          $cond:{
            if:{$in: [
  new mongoose.Types.ObjectId(req.user._id),
  "$subscribers.subscriber"
]},
            then:true,
            else:false
          }
        }
      }
    }
    ,{
      $project:{
        fullName:1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1
      }
    }
  ])
  if(!channel?.length){
    throw new ApiError(404,"channel does not exist");

  }
  return res.status(200)
  .json(
    new ApiResponse(200,channel[0],"User channel fetched successfully")
  )

})

const getWatchHistory = asyncHandler(async(req,res)=>{
  
      if (!req.user?._id) {
  throw new ApiError(401, "Unauthorized")
}
  const user = await User.aggregate([
    {

$match: {
  _id: new mongoose.Types.ObjectId(req.user._id)
}
    
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullName:1,
                    username:1,
                    avatar:1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }

    }
  ])

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      user?.[0]?.watchHistory||[]
      ,"watch history fetched successfully"
    )
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
}