import * as express from 'express';
export const userRouter = express.Router();
import * as UserController from '../controllers/user.controller';
//const key = "2e35f242a46d67eeb74aabc37d5e5d05";
userRouter.post('/login/otp', UserController.loginotp);
userRouter.get('/data/:LoginMethod', UserController.logInMiddwre, UserController.dispData);
userRouter.post('/signup/:LoginMethod', UserController.signup);
//router.post('/signup/mobile', UserController.signupMobile);
userRouter.post('/login/:LoginMethod', UserController.logInMiddwre, UserController.login);
//router.post('/login/mobile', UserController.loginMobile);
userRouter.post('/getotp', UserController.getotp);
userRouter.get('/verify/:token/:UserVerificationType', UserController.verify);
userRouter.get('/reset/:token/:Password/:LoginMethod', UserController.reset);
userRouter.post('/forgotpassword/:LoginMethod', UserController.forgotpassword);
userRouter.put('/update/:LoginMethod', UserController.logInMiddwre, UserController.update);
userRouter.delete('/delete/:LoginMethod', UserController.logInMiddwre, UserController.deleteUser);
