<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/** مدیر باشگاه */
class Admin extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'admins';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = [];
    protected $hidden = ['password'];

    public function role(): string
    {
        return 'admin';
    }
}