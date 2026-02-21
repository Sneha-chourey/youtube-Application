import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
const videoSchema = new Schema(
      {
    videoFile: {
      type: String, // URL of uploaded video (Cloudinary/S3 etc.)
      required: true,
      trim: true,
    },

    thumbnail: {
      type: String, // URL of thumbnail image
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: Number, // store in seconds
      required: true,
      min: 0,
    },

    views: {
      type: Number,
      default: 0, // default value
      min: 0,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // reference to User model
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
)
videoSchema.plugin(mongooseAggregatePaginate)
export const video = mongoose.model("video",videoSchema)