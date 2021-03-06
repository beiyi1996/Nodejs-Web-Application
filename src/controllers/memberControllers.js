import Member from '../../models/member'
import Bcrypt from 'bcryptjs'
import Crypto from 'crypto'
import NodeMailer from 'nodemailer'
import { validationResult } from '../../node_modules/express-validator'
import { account, oauth } from '../mailPassword.js'

const register = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    console.log('errors is not empty!!!')
    res.status(422).json({
      code: 422,
      errors: errors.array(),
    })
    return
  }
  try {
    const { email, password, gender, phone, name } = req.body
    const bcryptPassword = Bcrypt.hashSync(password, 10)
    console.log('bcryptPassword', bcryptPassword)
    const member = await Member.create({
      email,
      password: bcryptPassword,
      gender,
      phone,
      name,
    })
    res.status(200).json({ code: 200, message: 'register success', member })
  } catch (err) {
    console.log('error!!!', err)
    return next(err)
  }
}

const logIn = async (req, res, next) => {
  console.log(req.body)
  let isLogIn = false
  try {
    const errors = validationResult(req)
    const { email, password } = req.body
    Member.findOne(
      {
        email: email,
      },
      (err, member) => {
        if (err) next(err)
        if (!member) {
          console.log('This email is unregistered')
          return res.status(400).json({
            code: 400,
            message: 'This email is unregistered',
            email: email,
          }) // 會員未註冊
        }
        console.log(333, member.name)
        console.log('member.password', member.password)
        console.log('body.password', Bcrypt.hashSync(password, 10))
        Bcrypt.compare(password, member.password, (err, result) => {
          console.log('result', result)
          if (result) {
            isLogIn = true
            req.session.member = member.name
            req.session.isLogIn = isLogIn
            createTokenAndSaveDB(email, 'login', next)
            res.status(200).json({
              code: 200,
              member: member.name,
              email: member.email,
              login: isLogIn,
            })
            console.log('req.session', req.session)
          } else {
            res.status(401).json({
              code: 401,
              message: 'Password is worng.',
            })
          }
        })
      }
    )
  } catch (err) {
    return next(err)
  }
}

let transporter = NodeMailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: account.email,
    clientId: oauth.clientId,
    clientSecret: oauth.clientSecret,
    refreshToken: oauth.refreshToken,
    accessToken: oauth.accessToken,
  },
})

async function createMail(email, token) {
  console.log(18901394, account, token)
  console.log(555555, transporter)

  transporter.sendMail(
    {
      from: account.email, // sender address
      to: email, // list of receivers
      subject: 'forget password', // Subject line
      text: '美食家 - 修改密碼通知信', // plain text body
      html: `<div><h3>請至連結更改密碼 : <a href="https://bookingsystemclient.herokuapp.com/modifypassword?token=${token}">修改密碼</a></h3><p>若無法點擊連結，請複製下列網址至流覽器 : https://bookingsystemclient.herokuapp.com/modifypassword?token=${token}</p></div>`, // html body
    },
    (err, res) => {
      if (err) return console.log('send mail error', err)
      else console.log(JSON.stringify(res))
    }
  )
}

function createTokenAndSaveDB(email, type, next) {
  console.log(333, 'email', email)
  console.log(666, 'createToken and Save db type', type)
  let buffer = Crypto.randomBytes(32)
  let time = new Date()
  Member.findOne(
    {
      email: email,
    },
    (err, data) => {
      if (err) next(err)
      console.log('data', data)
      data.token = buffer.toString('hex')
      data.create_token_time = time
      data.modified_time = time
      Member(data).save((err, member) => {
        if (err) next(err)
        console.log(1234, 'member', member)
      })

      if (type === 'login') {
        return console.log('token is saved in db')
      } else {
        console.log(1233094, 'else data.token', data.token)
        createMail(data.email, data.token).catch(console.error)
      }
    }
  )
}

const forgotPassword = (req, res, next) => {
  console.log('22222', req.body)
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(422).json({
        code: 422,
        errors: errors.array(),
      })
      return
    }
    const { email } = req.body
    console.log('email', email)
    createTokenAndSaveDB(email, 'forgotPassword', next)
    res.status(200).json({
      code: 200,
      message: 'send forgot password email',
    })
  } catch (err) {
    console.log('error!')
    return next(err)
  }
}

const modifyPassword = (req, res, next) => {
  console.log('modifyPasswordGet req.query', req.query)
  const { token } = req.query
  let now = new Date()
  Member.findOne(
    {
      token: token,
    },
    (err, data) => {
      console.log('data', data)
      if (err) next(err)
      console.log('now', typeof now, now.getTime())
      let maturityTime = data.create_token_time.getTime() + 600000
      console.log('maturityTime', typeof maturityTime, maturityTime)
      if (now.getTime() < maturityTime) {
        res.status(200).json({
          code: 200,
          email: data.email,
        })
      } else {
        console.log('modify password get token is expired!!!')
        createTokenAndSaveDB(data.email)
        res.status(400).json({ code: 400, message: 'token is expired' })
      }
    }
  )
}

const changePassword = (req, res, next) => {
  console.log('Modify password post is working!!!', res.body)
  const { email, password } = req.body
  Member.findOne(
    {
      email: email,
    },
    (err, data) => {
      if (err) next(err)
      data.password = Bcrypt.hashSync(password, 10)
      data.create_time = Date.now()
      data.modified_time = Date.now()
      Member(data).save((err, member) => {
        if (err) next(err)
        console.log('modified member data', member)
        res.status(200).json({
          code: 200,
          message: 'save the modified.',
        })
      })
    }
  )
}

const logOut = (req, res, next) => {
  console.log('logout req.body', req.body)
  try {
    if (req.body.logInStatus) {
      req.session.destroy()
      res.status(200).json({
        code: 200,
        message: 'Log out successful!',
      })
    } else {
      res.status(403).json({
        code: 403,
        message: 'You are not log in!',
      })
    }
  } catch (err) {
    return next(err)
  }
}

const checkLogInStatus = (req, res, next) => {
  const { name } = req.body
  const member = Member.findOne({ name: name }, { _id: 1, name: 1, token: 1, create_token_time: 1 })
  console.log('member', member)
  const limitTime = mwmber.create_token_time !== null ? member.create_token_time + 600000 : 0
  if (!member.token || Date.now() > limitTime) {
    res.status(403).json({
      code: 403,
      message: 'You are not log in',
    })
  } else {
    res.status(200).json({
      code: 200,
      message: 'You are log in',
    })
  }
}

module.exports = {
  register,
  logIn,
  forgotPassword,
  modifyPassword,
  changePassword,
  logOut,
  checkLogInStatus,
}
