import jwt from 'jsonwebtoken';



export const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
    expiresIn: "1h", // access token expires in 15 minutes
  });
};
