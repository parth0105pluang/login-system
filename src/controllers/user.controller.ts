//sonarjs/cognitive-complexity
import * as bcrypt from 'bcrypt';
import { Buffer } from 'buffer';
import * as fast2sms from 'fast-two-sms';
import * as jwt from 'jsonwebtoken';
import * as mongoose from 'mongoose';
import * as nodemailer from 'nodemailer';
import * as otpGenerator from 'otp-generator';

import envi from '../config';
import * as client from '../helpers/account.cache';
import logger from '../helpers/logger';
import User from '../models/user.model';
global.Buffer = global.Buffer || Buffer;
//const USER_VERIFICATION_TOKEN_SECRET = envi.USER_VERIFICATION_TOKEN_SECRET;
if (typeof btoa === 'undefined') {
    global.btoa = function (str) {
        return new Buffer(str, 'binary').toString('base64');
    };
}
if (typeof atob === 'undefined') {
    global.atob = function (b64Encoded) {
        return new Buffer(b64Encoded, 'base64').toString('binary');
    };
}
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: envi.EMAIL_USERNAME,
        pass: envi.EMAIL_PASSWORD,
    },
});
const ResponseMessages = {
    verify: 'Verify your Account.',
    wrongPass: 'Wrong Password',
    noUser: 'User does not exists',
};
export async function signup(req, res) {
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    const { mobile } = req.body;
    const { email } = req.body;
    const { firstname } = req.body;
    const { lastname } = req.body;
    const { password } = req.body;
    if (!IncomingUser[LoginMethod]) {
        return res.status(422).send({ message: `Missing ${LoginMethod}` });
    }
    try {
        // Check if the email is in use
        const existingUser = await User.findOne(IncomingUser).exec();
        if (existingUser) {
            return res.status(409).send({
                message: `${LoginMethod} is already in use.`,
            });
        }
        // Step 1 - Create and save the user
        const user = await new User({
            _id: new mongoose.Types.ObjectId(),
            email: email,
            firstname: firstname,
            lastname: lastname,
            password: password,
            mobile: mobile,
        }).save();
        //Cache the data
        try {
            client.addUser(user, IncomingUser[LoginMethod]);
            bcrypt.hash(password, 10, function (err, hash) {
                if (err) {
                    logger.info(err);
                }
                client.addFeild(IncomingUser[LoginMethod], 'password', hash);
            });
        } catch (error) {
            logger.info(error);
        }

        // Step 2 - Generate a verification token with the user's ID
        const verificationToken = user.generateVerificationToken();
        // Step 3 - Email the user a unique verification link
        const url = `http://localhost:3000/user/verify/${verificationToken}/${LoginMethod}`;
        logger.info(url);
        if (LoginMethod == 'email') {
            transporter.sendMail({
                to: email,
                subject: 'Verify Account',
                html: `Click <a href = '${url}'>here</a> to confirm your email.`,
            });
            return res.status(201).send({
                message: `Sent a verification email to ${email}`,
            });
        } else if (LoginMethod == 'mobile') {
            const options = {
                authorization: 'zRoW9QuKVcC5qhgIYnbDXrmPdZT36iajk8pJ4tFUL2xvNwESAybHQcfnlaOJ2DBqIVsg46F0ijUrzM38',
                message: url,
                numbers: [mobile],
            };

            const response = await fast2sms.sendMessage(options);
            res.status(201).send(response);
        }
    } catch (err) {
        logger.info(err);
        return res.status(500).send(err);
    }
}
export async function verify(req, res) {
    logger.info('verify called');
    const { token } = req.params;
    const { UserVerificationType } = req.params;
    // Check we have an id
    if (!token) {
        return res.status(422).send({
            message: 'Missing Token',
        });
    }
    // Step 1 -  Verify the token from the URL
    let payload;
    try {
        payload = jwt.verify(token, envi.USER_VERIFICATION_TOKEN_SECRET as string);
    } catch (err) {
        return res.status(500).send(err);
    }
    try {
        // Step 2 - Find user with matching ID
        const user = await User.findOne({ _id: payload.ID }).exec();
        const cache = await client.GetAll(user[UserVerificationType]);
        if (!user) {
            return res.status(404).send({
                message: 'User does not  exists',
            });
        }
        // Step 3 - Update user verification status to true
        if (UserVerificationType == 'mobile') {
            user.mobile_verified = true;
            if (Object.keys(cache).length != 0) {
                await client.addFeild(user.mobile, 'mobile_verified', 'true');
            }
        } else if (UserVerificationType == 'email') {
            user.mail_verified = true;
            if (Object.keys(cache).length != 0) {
                await client.addFeild(user.email, 'mail_verified', 'true');
            }
        }
        await user.save();
        return res.status(200).send({
            message: 'Account Verified',
        });
    } catch (err) {
        logger.info(err);
        return res.status(500).send(err);
    }
}
export async function login(req, res) {
    return res.status(200).send({
        message: 'logged in',
    });
}
export async function forgotpassword(req, res) {
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    const user = await User.findOne(IncomingUser).exec();
    const verificationToken = user.generateVerificationToken();
    const encodedData = btoa(req.body.newpassword.toString());
    const Password = encodedData;
    logger.info(verificationToken);
    // Step 3 - Email the user a unique verification link
    const url = `http://localhost:3000/user/reset/${verificationToken}/${Password}/${LoginMethod}`;
    logger.info(url);
    logger.info(LoginMethod);
    if (LoginMethod == 'mobile') {
        const options = {
            authorization: 'zRoW9QuKVcC5qhgIYnbDXrmPdZT36iajk8pJ4tFUL2xvNwESAybHQcfnlaOJ2DBqIVsg46F0ijUrzM38',
            message: 'your reset link: ' + url,
            numbers: [IncomingUser[LoginMethod]],
        };
        try {
            fast2sms.sendMessage(options);
        } catch (error) {
            logger.info(error);
        }
        return res.status(201).send({
            message: `Sent a verification sms to ${LoginMethod}`,
        });
    } else if (LoginMethod == 'email') {
        transporter.sendMail({
            to: IncomingUser[LoginMethod],
            subject: 'Password Reset',
            html: `Click <a href = '${url}'>here</a> to confirm your email for password reset.`,
        });
        return res.status(201).send({
            message: `Sent a verification email to ${LoginMethod}`,
        });
    }
}

export async function reset(req, res) {
    logger.info('reset called');
    const { token } = req.params;
    const LoginMethod = req.params.LoginMethod;
    //IncomingUser = {};
    //IncomingUser[LoginMethod] = req.body[LoginMethod];
    // Check we have an id
    if (!token) {
        return res.status(422).send({
            message: 'Missing Token',
        });
    }
    // Step 1 -  Verify the token from the URL
    let payload;
    try {
        payload = jwt.verify(token, envi.USER_VERIFICATION_TOKEN_SECRET as string);
    } catch (err) {
        return res.status(500).send(err);
    }
    try {
        // Step 2 - Find user with matching ID
        const user = await User.findOne({ _id: payload.ID }).exec();
        if (!user) {
            return res.status(404).send({
                message: 'User does not  exists',
            });
        }
        // Step 3 - Update user verification status to true
        logger.info(req.params.Password);
        try {
            //var decrypted = CryptoJS.AES.decrypt(req.params.Password, key).toString(CryptoJS.enc.Utf8);
            const cache = await client.GetAll(user[LoginMethod]);
            logger.info(LoginMethod);
            if (Object.keys(cache).length != 0) {
                if (
                    (LoginMethod == 'email' && cache.mail_verified == 'false') ||
                    (LoginMethod == 'mobile' && cache.mobile_verified == 'false')
                ) {
                    return res.status(403).send({
                        message: ResponseMessages.verify,
                    });
                }
                const decodedData = atob(req.params.Password);
                logger.info('DecodedData: ' + decodedData);
                bcrypt.hash(decodedData, 10, function (err, hash) {
                    client.addFeild(user[LoginMethod], 'password', hash);
                });
            }
            const decodedData = atob(req.params.Password);
            user.password = decodedData;
        } catch (err) {
            logger.info(err);
        }

        await user.save();
        return res.status(200).send({
            message: 'Password Changed',
        });
    } catch (err) {
        return res.status(500).send(err);
    }
}

export async function getotp(req, res) {
    const { mobile } = req.body;
    // Check we have an email
    if (!mobile) {
        return res.status(422).send({
            message: 'Missing mobile number.',
        });
    }
    try {
        // Step 1 - Verify a user with the email exists
        const user = await User.findOne({ mobile }).exec();
        if (!user) {
            return res.status(404).send({
                message: ResponseMessages.noUser,
            });
        }
        // Step 2 - Ensure the account has been verified
        if (!user.mobile_verified) {
            return res.status(403).send({
                message: ResponseMessages.verify,
            });
        }
        const otp = otpGenerator.generate(8, {});
        const options = {
            authorization: 'zRoW9QuKVcC5qhgIYnbDXrmPdZT36iajk8pJ4tFUL2xvNwESAybHQcfnlaOJ2DBqIVsg46F0ijUrzM38',
            message: 'your otp: ' + otp,
            numbers: [mobile],
        };
        fast2sms
            .sendMessage(options)
            .then((response) => res.status(201).send(response))
            .catch((err) => {
                logger.info(err);
            });
        user.otp = otp;
        user.save();
    } catch (err) {
        return res.status(500).send(err);
    }
}
export async function loginotp(req, res) {
    const { mobile } = req.body;
    const { otp } = req.body;
    // Check we have an email
    if (!mobile) {
        return res.status(422).send({
            message: 'Missing mobile number.',
        });
    }
    try {
        // Step 1 - Verify a user with the email exists
        const user = await User.findOne({ mobile }).exec();
        if (!user) {
            return res.status(404).send({
                message: ResponseMessages.noUser,
            });
        }
        // Step 2 - Ensure the account has been verified
        if (!user.mobile_verified) {
            return res.status(403).send({
                message: ResponseMessages.verify,
            });
        }
        if (user.otp != otp) {
            return res.status(401).send({
                message: 'Wrong OTP',
            });
        }
        if (user.otp == otp) {
            logger.info('LOGGED IN');
            return res.status(200).send({
                message: 'Logged In',
            });
        }
    } catch (err) {
        logger.info(err);
        return res.status(500).send(err);
    }
}
export async function update(req, res) {
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    const user = await User.findOne(IncomingUser).exec();
    const cache = await client.GetAll(IncomingUser[LoginMethod]);
    const { email } = req.body;
    const { firstname } = req.body;
    const { lastname } = req.body;
    const { mobile } = req.body;
    if (req.body.firstname) {
        user.firstname = firstname;
    }
    if (req.body.lastname) {
        user.lastname = lastname;
    }
    if (req.body.newpassword) {
        user.password = req.body.newpassword;
    }
    if (LoginMethod == 'mobile') {
        if (req.body.email) {
            user.email = email;
        }
        if (Object.keys(cache).length != 0) {
            client.addUser(user, IncomingUser[LoginMethod]);
        }
    }
    if (LoginMethod == 'email') {
        if (req.body.mobile) {
            user.mobile = mobile;
        }
        if (Object.keys(cache).length != 0) {
            client.addUser(user, IncomingUser[LoginMethod]);
        }
    }
    logger.info(user);
    user.save(function () {
        logger.info('Saved');
    });
    return res.status(200).send({
        message: 'Updated!!',
    });
}
export async function logInMiddwre(req, res, next: () => void) {
    //const { mobile } = req.body;
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    // Check we have an valid login method
    //logger.info(req.session.LoginMethod==req.body[LoginMethod]);
    if (req.session.LoginMethod == req.body[LoginMethod]) {
        logger.info('Logged using cokkie');
        next();
    } else if (!IncomingUser[LoginMethod]) {
        return res.status(422).send({
            message: `Missing ${LoginMethod}.`,
        });
    }
    const user = await User.findOne(IncomingUser).exec();
    if (!user) {
        return res.status(404).send({
            message: ResponseMessages.noUser,
        });
    }
    try {
        // Step 2 - Ensure the account has been verified
        if ((LoginMethod == 'mobile' && !user.mobile_verified) || (LoginMethod == 'email' && !user.mail_verified)) {
            return res.status(403).send({
                message: ResponseMessages.verify,
            });
        }
        user.comparePassword(req.body.password, function (err, isMatch) {
            if (err) throw err;
            logger.info('Password Matched', isMatch);
            if (isMatch) {
                req.session.LoginMethod = IncomingUser[LoginMethod];
                next();
            } else {
                return res.status(403).send({
                    message: ResponseMessages.wrongPass,
                });
            }
        });
    } catch (err) {
        return res.status(500).send(err);
    }
}
export async function dispData(req, res) {
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    const cache = await client.GetAll(IncomingUser[LoginMethod]);

    if (Object.keys(cache).length != 0) {
        return res.status(200).send({
            cache,
        });
    } else {
        const user = await User.findOne(IncomingUser).exec();
        return res.status(200).send({
            user,
        });
    }
}
export async function deleteUser(req, res) {
    logger.info('Delete Called');
    const LoginMethod = req.params.LoginMethod;
    const IncomingUser = {};
    IncomingUser[LoginMethod] = req.body[LoginMethod];
    const cache = await client.GetAll(IncomingUser[LoginMethod]);
    const user = await User.findOne(IncomingUser).exec();
    if (Object.keys(cache).length != 0) {
        client
            .delUser(IncomingUser[LoginMethod])
            .then(function () {
                logger.info('Data deleted from redis'); // Success
                return 'Success Data deleted from redis';
            })
            .catch(function (error) {
                logger.info(error); // Failure
            });
    }
    if (user) {
        User.deleteOne(IncomingUser, (err) => {
            if (err) {
                logger.info(err);
            } else {
                logger.info('Data deleted from mongo');
            }
        });
    }
    return res.status(200).send({
        message: 'Deleted your account',
    });
}
