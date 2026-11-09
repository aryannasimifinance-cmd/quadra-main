<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

/** عضو / بازیکن */
class Member extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'members';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = [];
    protected $hidden = ['password'];

    public function role(): string
    {
        return 'player';
    }
}